import type { TournamentRepo } from '../ports/tournament-repo.js';
import type { PaymentGateway } from '../ports/payment-gateway.js';
import type { Tournament } from '../../domain/tournament.js';
import { lamportsToSol } from '../../domain/sol.js';

export interface Refund {
  wallet: string;
  amountSol: number;
  signature: string;
}

// Aborted tournament (e.g. inactivity timeout): refund every participant's entry fee.
export async function cancelTournament(
  repo: TournamentRepo,
  gateway: PaymentGateway,
  tournamentId: string,
  now: number,
): Promise<{ tournament: Tournament; refunds: Refund[] }> {
  const t = repo.get(tournamentId);
  if (!t) throw new Error('tournament not found');

  const entrySol = lamportsToSol(t.config.entryFeeLamports);
  const refunds: Refund[] = [];
  for (const p of t.participants) {
    const signature = await gateway.transfer(p.wallet, entrySol);
    refunds.push({ wallet: p.wallet, amountSol: entrySol, signature });
  }

  const cancelled: Tournament = { ...t, status: 'cancelled', endedAt: now };
  repo.save(cancelled);
  return { tournament: cancelled, refunds };
}
