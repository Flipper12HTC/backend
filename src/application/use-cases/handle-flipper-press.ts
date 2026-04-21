import type { PhysicsWorld } from '../ports/physics-world.js';
import type { FlipperSide } from '../../domain/flipper.js';

export function handleFlipperPress(physics: PhysicsWorld, side: FlipperSide): void {
  physics.applyFlipperImpulse(side);
}
