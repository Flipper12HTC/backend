import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FakePaymentGateway } from '../../../src/infrastructure/blockchain/fake-payment-gateway.js';
import { createChallengeBox, CHALLENGE } from '../../../src/domain/challenge.js';
import { createInitialState } from '../../../src/domain/game.js';
import {
  offerChallenge,
  pollChallenge,
  dismissChallenge,
  settleChallenge,
} from '../../../src/application/use-cases/challenge-flow.js';
import type { GameEvent } from '../../../src/application/ports/game-publisher.js';

// One challenge scenario in a box: fake gateway, empty state, captured events.
function setup(autoConfirm: boolean) {
  const gateway = new FakePaymentGateway(autoConfirm);
  const box = createChallengeBox();
  const state = createInitialState();
  const events: GameEvent[] = [];
  const publisher = { broadcast: (e: GameEvent) => events.push(e) };
  return { gateway, box, state, events, publisher };
}

describe('challenge flow use-cases', () => {
  it('offers a challenge with a scannable QR url', () => {
    const { gateway, box, publisher, events } = setup(false);

    offerChallenge(gateway, box, publisher);

    assert.equal(box.current?.status, 'offered');
    assert.ok(box.current?.qrUrl.startsWith('solana:'));
    assert.equal(events.at(-1)?.type, 'challenge_updated');
  });

  it('stays offered while the entry fee has not arrived', async () => {
    const { gateway, box, state, publisher } = setup(false);
    offerChallenge(gateway, box, publisher);

    await pollChallenge(gateway, box, state, publisher);

    assert.equal(box.current?.status, 'offered');
    assert.equal(state.player.wallet, null);
  });

  it('becomes paid once the fee arrives and names the player on the leaderboard', async () => {
    const { gateway, box, state, publisher } = setup(true);
    offerChallenge(gateway, box, publisher);

    await pollChallenge(gateway, box, state, publisher);

    assert.equal(box.current?.status, 'paid');
    assert.match(state.player.wallet ?? '', /^.{4}\.\.\..{4}$/); // e.g. "FAKE...1234"
  });

  it('dismisses an unpaid offer when a free game starts', () => {
    const { gateway, box, publisher, events } = setup(false);
    offerChallenge(gateway, box, publisher);

    dismissChallenge(box, publisher);

    assert.equal(box.current, null);
    const last = events.at(-1);
    assert.equal(last?.type === 'challenge_updated' && last.payload.status, 'none');
  });

  it('never dismisses a paid challenge', async () => {
    const { gateway, box, state, publisher } = setup(true);
    offerChallenge(gateway, box, publisher);
    await pollChallenge(gateway, box, state, publisher);

    dismissChallenge(box, publisher);

    assert.equal(box.current?.status, 'paid');
  });

  it('pays the reward when the final score beats the target', async () => {
    const { gateway, box, state, publisher } = setup(true);
    offerChallenge(gateway, box, publisher);
    await pollChallenge(gateway, box, state, publisher);

    await settleChallenge(gateway, box, publisher, CHALLENGE.targetScore + 1);

    assert.equal(box.current?.status, 'won');
    assert.deepEqual(gateway.transfers, [
      { toWallet: box.current?.wallet, amountSol: CHALLENGE.rewardSol },
    ]);
  });

  it('pays nothing when the target is missed', async () => {
    const { gateway, box, state, publisher } = setup(true);
    offerChallenge(gateway, box, publisher);
    await pollChallenge(gateway, box, state, publisher);

    await settleChallenge(gateway, box, publisher, CHALLENGE.targetScore);

    assert.equal(box.current?.status, 'lost');
    assert.equal(gateway.transfers.length, 0);
  });
});
