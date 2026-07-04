import type { TournamentRepo } from '../ports/tournament-repo.js';
import type { Tournament, TournamentConfig } from '../../domain/tournament.js';
import { createTournament, MONO_TOURNAMENT_CONFIG } from '../../domain/tournament.js';

// Creates the single mono tournament. Rejects if one is already live.
export function createMonoTournament(
  repo: TournamentRepo,
  id: string,
  now: number,
  config: TournamentConfig = MONO_TOURNAMENT_CONFIG,
): Tournament {
  if (repo.getActive()) throw new Error('a tournament is already active');
  const t = createTournament(id, config, now);
  repo.save(t);
  return t;
}
