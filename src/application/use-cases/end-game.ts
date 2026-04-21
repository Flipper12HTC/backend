import type { GamePublisher } from '../ports/game-publisher.js';

export function endGame(publisher: GamePublisher): void {
  publisher.broadcast({ type: 'tick', timestamp: Date.now() });
}
