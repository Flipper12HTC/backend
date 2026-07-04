import type { TournamentRepo } from '../../application/ports/tournament-repo.js';
import type { Tournament } from '../../domain/tournament.js';

export class InMemoryTournamentRepo implements TournamentRepo {
  private readonly store = new Map<string, Tournament>();

  save(t: Tournament): void {
    this.store.set(t.id, t);
  }

  get(id: string): Tournament | undefined {
    return this.store.get(id);
  }

  getActive(): Tournament | undefined {
    for (const t of this.store.values()) {
      if (t.status === 'open' || t.status === 'running') return t;
    }
    return undefined;
  }

  list(): Tournament[] {
    return [...this.store.values()];
  }
}
