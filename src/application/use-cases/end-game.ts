import type { GamePublisher } from '../ports/game-publisher.js';

export function endGame(publisher: GamePublisher): void {
  publisher.broadcast({ type: 'game_over', payload: { finalScore: 0 } });
}
