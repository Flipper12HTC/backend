import type { ScoreRepo } from '../../application/ports/score-repo.js';
import type { Score } from '../../domain/score.js';

export class PostgresScoreRepo implements ScoreRepo {
  async saveFinal(_score: Score): Promise<void> {
    // TODO: implement with postgres client
  }

  async listTop(_n: number): Promise<Score[]> {
    // TODO: implement with postgres client
    return [];
  }
}
