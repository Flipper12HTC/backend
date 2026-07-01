import type { TournamentRepo } from '../ports/tournament-repo.js';
import type { PaymentGateway } from '../ports/payment-gateway.js';
import type { Tournament } from '../../domain/tournament.js';
import { pickWinner } from '../../domain/tournament.js';
import { lamportsToSol } from '../../domain/sol.js';

export interface FinalizeResult {
  tournament: Tournament;
  winner: string | null;
  prizeSol: number;
  payoutSignature: string | null;
}

// Normal end of tournament: pay the prize to the highest scorer.
export async function finalizeTournament(
  repo: TournamentRepo,
  gateway: PaymentGateway,
  tournamentId: string,
  now: number,
): Promise<FinalizeResult> {
  const t = repo.get(tournamentId);
  if (!t) throw new Error('tournament not found');

  const winner = pickWinner(t);
  const prizeSol = lamportsToSol(t.config.prizeLamports);
  let payoutSignature: string | null = null;
  if (winner) {
    payoutSignature = await gateway.transfer(winner, prizeSol);
  }

  const completed: Tournament = { ...t, status: 'completed', winner, endedAt: now };
  repo.save(completed);
  return { tournament: completed, winner, prizeSol, payoutSignature };
}
