import type { Tournament } from '../../domain/tournament.js';

export interface TournamentRepo {
  save(t: Tournament): void;
  get(id: string): Tournament | undefined;
  // The single live tournament (open or running), if any.
  getActive(): Tournament | undefined;
  list(): Tournament[];
}
