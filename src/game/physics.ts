import { createRequire } from 'module';
import { TABLE } from '../../contracts/table.js';

const require = createRequire(import.meta.url);

export interface BallConfig {
  radius: number;
  mass: number;
  restitution: number;
  friction: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RAPIER: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _world: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ballBody: any;

const SPAWN = {
  x: TABLE.ball.spawn.x,
  y: TABLE.ball.spawn.y + 1,
  z: TABLE.ball.spawn.z,
};

export async function createWorld(config: Partial<BallConfig> = {}): Promise<void> {
  RAPIER = require('@dimforge/rapier3d-compat');
  await RAPIER.init();

  const cfg: BallConfig = {
    radius: TABLE.ball.radius,
    mass: 1.0,
    restitution: 0.7,
    friction: 0.3,
    ...config,
  };

  _world = new RAPIER.World({ x: 0.0, y: -9.81, z: 1.1 });

  _ballBody = _world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(SPAWN.x, SPAWN.y, SPAWN.z)
      .setLinearDamping(0.1)
      .setAngularDamping(0.1)
      .setCcdEnabled(true),
  );

  _world.createCollider(
    RAPIER.ColliderDesc.ball(cfg.radius)
      .setRestitution(cfg.restitution)
      .setFriction(cfg.friction)
      .setMass(cfg.mass),
    _ballBody,
  );
}

export function stepWorld(dt: number): void {
  _world.timestep = dt;
  _world.step();
}

export function getBallPosition(): { x: number; y: number; z: number } {
  const pos = _ballBody.translation();
  return { x: pos.x, y: pos.y, z: pos.z };
}

export function resetBall(): void {
  _ballBody.setTranslation(SPAWN, true);
  _ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  _ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
}

export function getWorld(): unknown {
  return _world;
}

export function getRapier(): unknown {
  return RAPIER;
}
