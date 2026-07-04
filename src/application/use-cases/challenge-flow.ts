import type { PaymentGateway } from '../ports/payment-gateway.js';
import type { GamePublisher } from '../ports/game-publisher.js';
import type { GameState } from '../../domain/game.js';
import type { ChallengeBox } from '../../domain/challenge.js';
import { CHALLENGE, isWon, shortenWallet, toChallengeView } from '../../domain/challenge.js';

// The whole challenge lifecycle, driven by the composition root:
//   offer -> (poll until paid | dismiss when a free game starts) -> settle on game over.

function broadcast(publisher: GamePublisher, box: ChallengeBox): void {
  publisher.broadcast({ type: 'challenge_updated', payload: toChallengeView(box.current) });
}

/** Creates a fresh payment request and shows its QR on the backglass. */
export function offerChallenge(
  gateway: PaymentGateway,
  box: ChallengeBox,
  publisher: GamePublisher,
): void {
  const { url, reference } = gateway.createPaymentRequest(
    CHALLENGE.entryFeeSol,
    'Flipper 12 challenge',
    `Score over ${CHALLENGE.targetScore} to win ${CHALLENGE.rewardSol} SOL`,
  );
  box.current = { reference, qrUrl: url, status: 'offered', wallet: null };
  broadcast(publisher, box);
}

/** Checks the chain for the entry fee; once paid, the payer becomes the current player. */
export async function pollChallenge(
  gateway: PaymentGateway,
  box: ChallengeBox,
  state: GameState,
  publisher: GamePublisher,
): Promise<void> {
  const challenge = box.current;
  if (!challenge || challenge.status !== 'offered') return;

  const received = await gateway.getReceivedSol(challenge.reference);
  if (received < CHALLENGE.entryFeeSol) return;

  const wallet = await gateway.getPayerWallet(challenge.reference);
  box.current = { ...challenge, status: 'paid', wallet };
  // The shortened wallet becomes the leaderboard name for the scores of this game.
  state.player.wallet = wallet ? shortenWallet(wallet) : null;
  broadcast(publisher, box);
}

/** A free game started: drop the unpaid offer so the QR disappears. */
export function dismissChallenge(box: ChallengeBox, publisher: GamePublisher): void {
  if (!box.current || box.current.status !== 'offered') return;
  box.current = null;
  broadcast(publisher, box);
}

/** Game over on a paid challenge: pay the reward if the target score is beaten. */
export async function settleChallenge(
  gateway: PaymentGateway,
  box: ChallengeBox,
  publisher: GamePublisher,
  finalScore: number,
): Promise<void> {
  const challenge = box.current;
  if (!challenge || challenge.status !== 'paid' || !challenge.wallet) return;

  const won = isWon(finalScore);
  if (won) await gateway.transfer(challenge.wallet, CHALLENGE.rewardSol);
  box.current = { ...challenge, status: won ? 'won' : 'lost' };
  broadcast(publisher, box);
}
