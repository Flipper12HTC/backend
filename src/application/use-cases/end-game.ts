import type { GamePublisher } from '../ports/game-publisher.js';
import type { GameState } from '../../domain/game.js';

export function endGame(state: GameState, publisher: GamePublisher): void {
  if (state.status !== 'running') return;

  state.status = 'over';
  state.endedAt = Date.now();

  publisher.broadcast({
    type: 'game_over',
    payload: { finalScore: state.score },
  });
}
