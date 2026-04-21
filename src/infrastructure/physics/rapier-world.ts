import { createRequire } from 'module';
import type * as RapierLib from '@dimforge/rapier3d-compat';
import type { PhysicsWorld, BallConfig } from '../../application/ports/physics-world.js';
import type { Vec3 } from '../../domain/ball.js';
import type { FlipperSide } from '../../domain/flipper.js';
import { PLAYFIELD } from '../../domain/playfield.js';

type RapierModule = typeof RapierLib;

interface InitConfig extends Partial<BallConfig> {
  wallHeight?: number;
}

const _require = createRequire(import.meta.url);

export class RapierPhysicsWorld implements PhysicsWorld {
  private r!: RapierModule;
  private world!: RapierLib.World;
  private ballBody!: RapierLib.RigidBody;

  async init(config: InitConfig = {}): Promise<void> {
    this.r = _require('@dimforge/rapier3d-compat') as RapierModule;
    await this.r.init();

    const cfg: BallConfig = {
      radius: PLAYFIELD.ball.radius,
      mass: 1.0,
      restitution: 0.7,
      friction: 0.3,
      ...config,
    };

    this.world = new this.r.World({ x: 0.0, y: -9.81, z: 1.1 });

    this.ballBody = this.world.createRigidBody(
      this.r.RigidBodyDesc.dynamic()
        .setTranslation(
          PLAYFIELD.ball.spawn.x,
          PLAYFIELD.ball.spawn.y + 1,
          PLAYFIELD.ball.spawn.z,
        )
        .setLinearDamping(0.1)
        .setAngularDamping(0.1)
        .setCcdEnabled(true),
    );

    this.world.createCollider(
      this.r.ColliderDesc.ball(cfg.radius)
        .setRestitution(cfg.restitution)
        .setFriction(cfg.friction)
        .setMass(cfg.mass),
      this.ballBody,
    );

    this.buildPlayfield(config.wallHeight);
  }

  private buildPlayfield(wallHeight?: number): void {
    const { width, depth, floorThickness, wall } = PLAYFIELD;
    const h = wallHeight ?? wall.height;

    this.addWall(0, -floorThickness / 2, 0, width, floorThickness, depth);
    this.addWall(-width / 2, h / 2, 0, wall.thickness, h, depth);
    this.addWall(width / 2, h / 2, 0, wall.thickness, h, depth);
    this.addWall(0, h / 2, -depth / 2, width, h, wall.thickness);
    this.addWall(0, h / 2, depth / 2, width, h, wall.thickness);
  }

  private addWall(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
  ): void {
    const body = this.world.createRigidBody(
      this.r.RigidBodyDesc.fixed().setTranslation(x, y, z),
    );
    this.world.createCollider(
      this.r.ColliderDesc.cuboid(w / 2, h / 2, d / 2),
      body,
    );
  }

  step(dt: number): void {
    this.world.timestep = dt;
    this.world.step();
  }

  getBallPosition(): Vec3 {
    const pos = this.ballBody.translation();
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  resetBall(): void {
    const spawn = {
      x: PLAYFIELD.ball.spawn.x,
      y: PLAYFIELD.ball.spawn.y + 1,
      z: PLAYFIELD.ball.spawn.z,
    };
    this.ballBody.setTranslation(spawn, true);
    this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  applyFlipperImpulse(_side: FlipperSide): void {
    // TODO: implement flipper rigid body + impulse
  }
}
