import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type * as RapierLib from '@dimforge/rapier3d-compat';
import type { PhysicsWorld, BallConfig, BumperHit } from '../../application/ports/physics-world.js';
import type { Vec3 } from '../../domain/ball.js';
import type { FlipperSide } from '../../domain/flipper.js';
import { PLAYFIELD } from '../../domain/playfield.js';
import { loadPlayfieldGeometry } from './glb-loader.js';

type RapierModule = typeof RapierLib;

interface InitConfig extends Partial<BallConfig> {
  wallHeight?: number;
  playfieldGlbPath?: string;
}

const DEFAULT_GLB_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../assets/models/BaseFlipper.glb',
);

interface FlipperBody {
  body: RapierLib.RigidBody;
  colliderHandle: number;
  restAngle: number;
  activeAngle: number;
  current: number;
  target: number;
}

const FLIPPER_HALF_HEIGHT = 0.25;
const FLIPPER_HALF_THICKNESS = 0.2;
const FLIPPER_BORDER_RADIUS = 0.04;
const FLIPPER_ROTATION_SPEED = 18;
const FLIPPER_RESTITUTION = 0.6;
const FLIPPER_FRICTION = 0.4;

function quatFromY(angle: number): { x: number; y: number; z: number; w: number } {
  const half = angle / 2;
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
}

const _require = createRequire(import.meta.url);

export class RapierPhysicsWorld implements PhysicsWorld {
  private r!: RapierModule;
  private world!: RapierLib.World;
  private ballBody!: RapierLib.RigidBody;
  private ballColliderHandle!: number;
  private leftFlipper!: FlipperBody;
  private rightFlipper!: FlipperBody;
  private eventQueue!: RapierLib.EventQueue;
  private flipperHits = 0;
  private bumpers = new Map<number, BumperHit>();
  private bumperHits: BumperHit[] = [];

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
    this.eventQueue = new this.r.EventQueue(true);

    this.ballBody = this.world.createRigidBody(
      this.r.RigidBodyDesc.dynamic()
        .setTranslation(PLAYFIELD.ball.spawn.x, PLAYFIELD.ball.spawn.y, PLAYFIELD.ball.spawn.z)
        .setLinearDamping(0.1)
        .setAngularDamping(0.1)
        .setCcdEnabled(true),
    );

    const ballCollider = this.world.createCollider(
      this.r.ColliderDesc.ball(cfg.radius)
        .setRestitution(cfg.restitution)
        .setFriction(cfg.friction)
        .setMass(cfg.mass)
        .setActiveEvents(this.r.ActiveEvents.COLLISION_EVENTS),
      this.ballBody,
    );
    this.ballColliderHandle = ballCollider.handle;

    await this.buildPlayfieldFromGlb(config.playfieldGlbPath ?? DEFAULT_GLB_PATH);
    this.leftFlipper = this.buildFlipper('left');
    this.rightFlipper = this.buildFlipper('right');
    for (const b of PLAYFIELD.bumpers) this.buildBumper(b);
  }

  private buildBumper(b: {
    id: string;
    x: number;
    z: number;
    radius: number;
    scale: number;
  }): void {
    const radius = b.radius * b.scale;
    const halfHeight = PLAYFIELD.wall.height / 2;
    const body = this.world.createRigidBody(
      this.r.RigidBodyDesc.fixed().setTranslation(b.x, halfHeight, b.z),
    );
    const collider = this.world.createCollider(
      this.r.ColliderDesc.cylinder(halfHeight, radius)
        .setRestitution(1.2)
        .setFriction(0.2)
        .setActiveEvents(this.r.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    this.bumpers.set(collider.handle, { id: b.id, x: b.x, z: b.z });
  }

  private async buildPlayfieldFromGlb(path: string): Promise<void> {
    const geom = await loadPlayfieldGeometry(path, {
      targetWidth: PLAYFIELD.width,
      targetDepth: PLAYFIELD.depth,
    });

    // Sol = floor (low friction so the ball can roll/slide).
    this.addTrimesh(geom.sol.vertices, geom.sol.indices, { friction: 0.1, restitution: 0.2 });
    // Murs = walls (bouncy, low friction so the ball glances off).
    this.addTrimesh(geom.murs.vertices, geom.murs.indices, { friction: 0.05, restitution: 0.6 });
  }

  private addTrimesh(
    vertices: Float32Array,
    indices: Uint32Array,
    opts: { friction: number; restitution: number },
  ): void {
    const body = this.world.createRigidBody(this.r.RigidBodyDesc.fixed());
    this.world.createCollider(
      this.r.ColliderDesc.trimesh(vertices, indices)
        .setFriction(opts.friction)
        .setRestitution(opts.restitution),
      body,
    );
  }

  private buildFlipper(side: FlipperSide): FlipperBody {
    const pivot = side === 'left' ? PLAYFIELD.flippers.left : PLAYFIELD.flippers.right;
    const sign = side === 'left' ? -1 : 1;
    const restAngle = sign * PLAYFIELD.flippers.restAngle;
    const activeAngle = sign * PLAYFIELD.flippers.activeAngle;
    const dir = side === 'left' ? 1 : -1;
    const halfLength = PLAYFIELD.flippers.length / 2;

    const body = this.world.createRigidBody(
      this.r.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(pivot.x, pivot.y, pivot.z)
        .setRotation(quatFromY(restAngle))
        .setCcdEnabled(true),
    );

    const collider = this.world.createCollider(
      this.r.ColliderDesc.roundCuboid(
        halfLength,
        FLIPPER_HALF_HEIGHT,
        FLIPPER_HALF_THICKNESS,
        FLIPPER_BORDER_RADIUS,
      )
        .setTranslation(dir * halfLength, 0, 0)
        .setRestitution(FLIPPER_RESTITUTION)
        .setFriction(FLIPPER_FRICTION)
        .setActiveEvents(this.r.ActiveEvents.COLLISION_EVENTS),
      body,
    );

    return {
      body,
      colliderHandle: collider.handle,
      restAngle,
      activeAngle,
      current: restAngle,
      target: restAngle,
    };
  }

  step(dt: number): void {
    this.tickFlipper(this.leftFlipper, dt);
    this.tickFlipper(this.rightFlipper, dt);
    this.world.timestep = dt;
    this.world.step(this.eventQueue);

    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const ball = this.ballColliderHandle;
      const other = h1 === ball ? h2 : h2 === ball ? h1 : -1;
      if (other === -1) return;
      if (this.isFlipperHandle(other)) {
        this.flipperHits += 1;
        return;
      }
      const bumper = this.bumpers.get(other);
      if (bumper) this.bumperHits.push(bumper);
    });
  }

  private isFlipperHandle(handle: number): boolean {
    return (
      handle === this.leftFlipper.colliderHandle || handle === this.rightFlipper.colliderHandle
    );
  }

  private tickFlipper(f: FlipperBody, dt: number): void {
    if (f.current === f.target) return;
    const delta = f.target - f.current;
    const max = FLIPPER_ROTATION_SPEED * dt;
    f.current += Math.abs(delta) <= max ? delta : Math.sign(delta) * max;
    f.body.setNextKinematicRotation(quatFromY(f.current));
  }

  getBallPosition(): Vec3 {
    const pos = this.ballBody.translation();
    return { x: pos.x, y: pos.y, z: pos.z };
  }

  getBallSpeed(): number {
    const v = this.ballBody.linvel();
    return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  }

  resetBall(): void {
    this.ballBody.setTranslation(PLAYFIELD.ball.spawn, true);
    this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  /** Test helper: place the ball at an arbitrary position with zero velocity. */
  setBallPosition(pos: Vec3): void {
    this.ballBody.setTranslation(pos, true);
    this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  applyBallImpulse(impulse: Vec3): void {
    this.ballBody.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
  }

  setFlipperActive(side: FlipperSide, active: boolean): void {
    const f = side === 'left' ? this.leftFlipper : this.rightFlipper;
    f.target = active ? f.activeAngle : f.restAngle;
  }

  consumeFlipperHits(): number {
    const n = this.flipperHits;
    this.flipperHits = 0;
    return n;
  }

  consumeBumperHits(): BumperHit[] {
    const hits = this.bumperHits;
    this.bumperHits = [];
    return hits;
  }
}
