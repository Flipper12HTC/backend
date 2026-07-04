import type { TournamentRepo } from '../ports/tournament-repo.js';
import type { Tournament } from '../../domain/tournament.js';
import { recordScore } from '../../domain/tournament.js';

// Stores a participant's final game score; also resets the inactivity timer.
export function recordTournamentScore(
  repo: TournamentRepo,
  tournamentId: string,
  wallet: string,
  score: number,
  now: number,
): Tournament {
  const t = repo.get(tournamentId);
  if (!t) throw new Error('tournament not found');
  const updated = recordScore(t, wallet, score, now);
  repo.save(updated);
  return updated;
}
