import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FakePaymentGateway } from '../../../src/infrastructure/blockchain/fake-payment-gateway.js';
import { InMemoryPaymentStore } from '../../../src/infrastructure/storage/in-memory-payment-store.js';
import { InMemoryTournamentRepo } from '../../../src/infrastructure/storage/in-memory-tournament-repo.js';
import { startPayment } from '../../../src/application/use-cases/start-payment.js';
import { refreshPayment } from '../../../src/application/use-cases/refresh-payment.js';
import { createMonoTournament } from '../../../src/application/use-cases/create-tournament.js';
import { joinTournament } from '../../../src/application/use-cases/join-tournament.js';
import { recordTournamentScore } from '../../../src/application/use-cases/record-tournament-score.js';
import { finalizeTournament } from '../../../src/application/use-cases/finalize-tournament.js';
import { cancelTournament } from '../../../src/application/use-cases/cancel-tournament.js';

// autoConfirm gateway: each payment is fully received on the first poll.
function setup() {
  const gateway = new FakePaymentGateway(true);
  const paymentStore = new InMemoryPaymentStore();
  const repo = new InMemoryTournamentRepo();
  return { gateway, paymentStore, repo };
}

async function paidEntry(gateway: FakePaymentGateway, store: InMemoryPaymentStore): Promise<string> {
  const { intent } = startPayment(gateway, store, 0.11, 'entry', 'fee', 0);
  await refreshPayment(gateway, store, intent.reference); // -> confirmed
  return intent.reference;
}

describe('tournament flow use-cases', () => {
  it('rejects a second active tournament', () => {
    const { repo } = setup();
    createMonoTournament(repo, 't1', 0);
    assert.throws(() => createMonoTournament(repo, 't2', 1), /already active/);
  });

  it('lets a player join only after the entry fee is confirmed', async () => {
    const { gateway, paymentStore, repo } = setup();
    const t = createMonoTournament(repo, 't1', 0);

    const ref = await paidEntry(gateway, paymentStore);
    const joined = joinTournament(repo, paymentStore, t.id, 'walletA', ref, 1);
    assert.equal(joined.participants.length, 1);
  });

  it('blocks join when the payment is not satisfied', () => {
    const { gateway, paymentStore, repo } = setup();
    const t = createMonoTournament(repo, 't1', 0);
    const { intent } = startPayment(gateway, paymentStore, 0.11, 'entry', 'fee', 0); // not refreshed
    assert.throws(
      () => joinTournament(repo, paymentStore, t.id, 'walletA', intent.reference, 1),
      /not fully paid/,
    );
  });

  it('pays the prize to the winner on finalize', async () => {
    const { gateway, paymentStore, repo } = setup();
    const t = createMonoTournament(repo, 't1', 0);
    joinTournament(repo, paymentStore, t.id, 'walletA', await paidEntry(gateway, paymentStore), 1);
    joinTournament(repo, paymentStore, t.id, 'walletB', await paidEntry(gateway, paymentStore), 2);
    recordTournamentScore(repo, t.id, 'walletA', 1000, 3);
    recordTournamentScore(repo, t.id, 'walletB', 5000, 4);

    const result = await finalizeTournament(repo, gateway, t.id, 5);
    assert.equal(result.winner, 'walletB');
    assert.equal(result.prizeSol, 1);
    assert.ok(result.payoutSignature);
    assert.equal(result.tournament.status, 'completed');
  });

  it('refunds everyone on cancel', async () => {
    const { gateway, paymentStore, repo } = setup();
    const t = createMonoTournament(repo, 't1', 0);
    joinTournament(repo, paymentStore, t.id, 'walletA', await paidEntry(gateway, paymentStore), 1);
    joinTournament(repo, paymentStore, t.id, 'walletB', await paidEntry(gateway, paymentStore), 2);

    const { tournament, refunds } = await cancelTournament(repo, gateway, t.id, 3);
    assert.equal(tournament.status, 'cancelled');
    assert.equal(refunds.length, 2);
    assert.equal(refunds[0]?.amountSol, 0.11);
  });
});
