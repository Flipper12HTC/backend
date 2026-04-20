import { world, RAPIER } from './world.js';
import { TABLE } from '../../contracts/table.js';

const ballBody = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(
      TABLE.ball.spawn.x,
      TABLE.ball.spawn.y + 1,
      TABLE.ball.spawn.z,
    )
    .setLinearDamping(0.1)
    .setAngularDamping(0.1)
    .setCcdEnabled(true),
);

world.createCollider(
  RAPIER.ColliderDesc.ball(TABLE.ball.radius)
    .setRestitution(0.7)  // rebond à 70%
    .setFriction(0.3),    // friction
  ballBody,
);

export function getBallPosition(): { x: number; y: number; z: number } {
  const pos = ballBody.translation();
  return { x: pos.x, y: pos.y, z: pos.z };
}

export function resetBall(): void {
  ballBody.setTranslation(
    {
      x: TABLE.ball.spawn.x,
      y: TABLE.ball.spawn.y + 1,
      z: TABLE.ball.spawn.z,
    },
    true,
  );
  ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
}