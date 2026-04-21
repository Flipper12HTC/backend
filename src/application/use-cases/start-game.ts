import type { PhysicsWorld } from '../ports/physics-world.js';
import type { GamePublisher } from '../ports/game-publisher.js';

export function startGame(physics: PhysicsWorld, publisher: GamePublisher): void {
  physics.resetBall();
  publisher.broadcast({ type: 'tick', timestamp: Date.now() });
}
