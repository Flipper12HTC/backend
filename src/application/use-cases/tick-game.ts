import type { PhysicsWorld } from '../ports/physics-world.js';
import type { GamePublisher } from '../ports/game-publisher.js';

export function tickGame(
  physics: PhysicsWorld,
  publisher: GamePublisher,
  dt: number,
): void {
  physics.step(dt);
  publisher.broadcast({ type: 'ball_position', payload: physics.getBallPosition() });
}
