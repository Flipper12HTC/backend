import type { TournamentRepo } from '../ports/tournament-repo.js';
import type { PaymentStore } from '../ports/payment-store.js';
import type { Tournament } from '../../domain/tournament.js';
import { addParticipant } from '../../domain/tournament.js';
import { isSatisfied } from '../../domain/payment.js';

// Adds a participant once their entry-fee payment is confirmed on-chain.
export function joinTournament(
  repo: TournamentRepo,
  paymentStore: PaymentStore,
  tournamentId: string,
  wallet: string,
  paymentReference: string,
  now: number,
): Tournament {
  const t = repo.get(tournamentId);
  if (!t) throw new Error('tournament not found');

  const payment = paymentStore.get(paymentReference);
  if (!payment) throw new Error('payment intent not found');
  if (!isSatisfied(payment)) throw new Error('entry fee not fully paid');

  const updated = addParticipant(t, wallet, paymentReference, now);
  repo.save(updated);
  return updated;
}
