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

    this.buildPlayfield(config.wallHeight);
    this.leftFlipper = this.buildFlipper('left');
    this.rightFlipper = this.buildFlipper('right');
  }

  private buildPlayfield(wallHeight?: number): void {
    const { width, depth, floorThickness, wall, cornerRadius, launchLane, drain } = PLAYFIELD;
    const h = wallHeight ?? wall.height;
    const halfW = width / 2;
    const halfD = depth / 2;
    const r = cornerRadius;

    this.addWall(0, -floorThickness / 2, 0, width, floorThickness, depth);

    // Side walls: shortened at the top to make room for the rounded corners
    const sideLength = depth - r;
    const sideCenterZ = r / 2;
    this.addWall(-halfW, h / 2, sideCenterZ, wall.thickness, h, sideLength);
    this.addWall(halfW, h / 2, sideCenterZ, wall.thickness, h, sideLength);

    // Top wall: shortened on both sides to make room for the rounded corners
    const topLength = width - 2 * r;
    this.addWall(0, h / 2, -halfD, topLength, h, wall.thickness);

    // Bottom wall: split into two lateral segments leaving a central drain gap
    // between the flippers so the ball can fall through.
    const bottomSegmentLength = (width - drain.gap) / 2;
    const bottomSegmentCenterX = halfW - bottomSegmentLength / 2;
    this.addWall(-bottomSegmentCenterX, h / 2, halfD, bottomSegmentLength, h, wall.thickness);
    this.addWall(bottomSegmentCenterX, h / 2, halfD, bottomSegmentLength, h, wall.thickness);

    // Rounded corners (3 segments per quarter circle)
    this.addRoundedCorner(halfW - r, -halfD + r, r, h, 'topRight');
    this.addRoundedCorner(-halfW + r, -halfD + r, r, h, 'topLeft');

    // Launch lane separator (right side, between flippers area and right wall)
    const sepLength = launchLane.zMax - launchLane.zMin;
    const sepCenterZ = (launchLane.zMax + launchLane.zMin) / 2;
    this.addWall(launchLane.separatorX, h / 2, sepCenterZ, wall.thickness, h, sepLength);
  }

  private addWall(x: number, y: number, z: number, w: number, h: number, d: number): void {
    const body = this.world.createRigidBody(this.r.RigidBodyDesc.fixed().setTranslation(x, y, z));
    this.world.createCollider(this.r.ColliderDesc.cuboid(w / 2, h / 2, d / 2), body);
  }

  private addRoundedCorner(
    cx: number,
    cz: number,
    radius: number,
    height: number,
    corner: 'topLeft' | 'topRight',
  ): void {
    const segments = 3;
    const thickness = PLAYFIELD.wall.thickness;
    const chordHalf = radius * Math.sin(Math.PI / (4 * segments));
    // top-right arc goes from angle 0 (+X) to -PI/2 (-Z); top-left mirrors over X
    const angleSign = corner === 'topRight' ? -1 : -1;
    const xSign = corner === 'topRight' ? 1 : -1;

    for (let i = 0; i < segments; i++) {
      const angle = angleSign * ((i + 0.5) * Math.PI) / (2 * segments);
      const segX = cx + xSign * radius * Math.cos(angle);
      const segZ = cz + radius * Math.sin(angle);
      // tangent to the arc at this angle, oriented in XZ plane
      const yaw = corner === 'topRight' ? -Math.PI / 2 - angle : Math.PI / 2 + angle;

      const body = this.world.createRigidBody(
        this.r.RigidBodyDesc.fixed()
          .setTranslation(segX, height / 2, segZ)
          .setRotation(quatFromY(yaw)),
      );
      this.world.createCollider(
        this.r.ColliderDesc.cuboid(chordHalf, height / 2, thickness / 2),
        body,
      );
    }
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
      this.r.ColliderDesc.cuboid(halfLength, FLIPPER_HALF_HEIGHT, FLIPPER_HALF_THICKNESS)
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
      const isBallFlipper =
        (h1 === ball && this.isFlipperHandle(h2)) ||
        (h2 === ball && this.isFlipperHandle(h1));
      if (isBallFlipper) this.flipperHits += 1;
    });
  }

  private isFlipperHandle(handle: number): boolean {
    return handle === this.leftFlipper.colliderHandle || handle === this.rightFlipper.colliderHandle;
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
}
