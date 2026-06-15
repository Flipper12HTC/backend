import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type * as RapierLib from '@dimforge/rapier3d-compat';
import type { PhysicsWorld, BallConfig, BumperHit } from '../../application/ports/physics-world.js';
import type { Vec3 } from '../../domain/ball.js';
import type { FlipperSide } from '../../domain/flipper.js';
import { PLAYFIELD } from '../../domain/playfield.js';
import { loadPlayfieldGeometry, type BumperPosition } from './glb-loader.js';

type RapierModule = typeof RapierLib;

interface InitConfig extends Partial<BallConfig> {
  wallHeight?: number;
  playfieldGlbPath?: string;
}

const DEFAULT_GLB_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../assets/models/FlipperBase.glb',
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
  private _laneSeparatorX: number = PLAYFIELD.launchLane.separatorX;
  private _spawnX: number = PLAYFIELD.ball.spawn.x;
  private _spawnZ: number = PLAYFIELD.ball.spawn.z;
  private _flipperPivots: { left: { x: number; y: number; z: number; length: number }; right: { x: number; y: number; z: number; length: number } } | null = null;
  private _derivedBumpers: BumperPosition[] = [];

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

    this.world = new this.r.World({ x: 0.0, y: -9.81, z: 1.1 }); // gravity toward +Z (drain at Z≈-2, far end at Z=-8)
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
    // Force a safe spawn location: X=4.3 well into the right plunger lane (between
    // the lane separator at X=3.5 and the right outer wall at X=4.5), Y=0.6 just
    // above the floor, Z=6 near the drain end of the corridor.
    this.ballBody.setTranslation({ x: 4.0, y: 0.6, z: 6.0 }, true);
    this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.leftFlipper = this.buildFlipper('left');
    this.rightFlipper = this.buildFlipper('right');
    // Bumpers derived from `col_bumper_marker_*` meshes in the GLB.
    // Fall back to PLAYFIELD.bumpers if the GLB lacks markers — preserves boot on legacy assets.
    const bumpers = this._derivedBumpers.length > 0 ? this._derivedBumpers : PLAYFIELD.bumpers;
    for (const b of bumpers) this.buildBumper(b);
  }

  private buildBumper(b: { id: string; x: number; z: number; radius: number; scale?: number }): void {
    const radius = b.radius * (b.scale ?? 1);
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
    // Store GLB-derived positions — the col_wall_plunger_lane mesh is the single source of
    // truth for both the lane separator (inner edge) and the ball spawn (lane centre).
    // PLAYFIELD.ball.spawn.x acts only as a safety default if the GLB lacks the lane mesh.
    this._laneSeparatorX = geom.derived.laneSeparatorX;
    this._spawnX = geom.derived.laneSpawnX;
    // _spawnZ is intentionally NOT overridden from the GLB — kept hardcoded so the ball
    // always spawns at the drain end of the lane, regardless of the lane mesh extent.
    this._flipperPivots = {
      left: geom.derived.flipperLeft,
      right: geom.derived.flipperRight,
    };
    this._derivedBumpers = geom.derived.bumpers;

    // Sol = GLB floor trimesh (inclined surface, exact map geometry).
    this.addTrimesh(geom.sol.vertices, geom.sol.indices, { friction: 0.1, restitution: 0.2 });
    // Inclined safety floor: thick box that follows the table's actual tilt computed from the
    // extracted floor vertices. Catches balls that tunnel through the thin trimesh and places
    // them at the correct visual height instead of the old flat Y=0 backup.
    this.addInclinedFloor(geom.sol.vertices);
    // Murs = walls from GLB (bouncy, low friction so the ball glances off).
    this.addTrimesh(geom.murs.vertices, geom.murs.indices, { friction: 0.05, restitution: 0.6 });
    // Aprons = inlane/outlane guide walls, bottom edge dropped to the floor by the loader
    // so the ball can't roll under them (apron_2 floated 0.31 above the floor).
    if (geom.aprons && geom.aprons.vertices.length > 0) {
      this.addTrimesh(geom.aprons.vertices, geom.aprons.indices, { friction: 0.05, restitution: 0.6 });
    }
    // Rampes = full ramp geometry (all face angles) so the ball rolls through the channel.
    if (geom.rampe && geom.rampe.vertices.length > 0) {
      this.addTrimesh(geom.rampe.vertices, geom.rampe.indices, { friction: 0.05, restitution: 0.4 });
    }
    // Solid box boundaries: the GLB outer wall has only 2 triangles on the far end and 6 per
    // side wall — too sparse to reliably stop a fast ball. Box colliders are the safety net.
    this.buildBoundaryWalls();
    // Lane separator: clean box wall between the shoot lane and the main playfield.
    // The GLB floor edge at that X had phantom triangles inside the lane — replaced by a box.
    // The separator stops just short of the far end (leaves an opening so the ball can
    // enter the playfield after travelling up the full lane).
    this.addLaneSeparator();
  }

  private addLaneSeparator(): void {
    const halfD = PLAYFIELD.depth / 2;
    const sep = this._laneSeparatorX;
    // Single thin wall on the inner edge of the plunger lane. Spans the lower 2/3
    // of the table — the upper third is open so the ball can swing into the playfield
    // once the plunger has pushed it up the corridor.
    // Height matches the ball envelope, NOT the full ceiling — a tall wall here would
    // form a vertical ceiling along the lane and trap the ball when it bounces inside
    // the corridor at Y > 1.
    const wallCenterZ = halfD - 5.5;        // covers roughly Z = -2 to +8 (drain side)
    const wallHalfZ   = 5.0;
    const wallCenterY = 0.4;                // mid-height of the ball envelope
    const wallHalfY   = 0.4;                // spans Y = 0 → 0.8 (just covers the ball)
    this.addBoxWall(sep, wallCenterY, wallCenterZ, 0.05, wallHalfY, wallHalfZ);
  }

  private buildBoundaryWalls(): void {
    const halfW = PLAYFIELD.width / 2;
    const halfD = PLAYFIELD.depth / 2;
    const halfH = PLAYFIELD.wall.height / 2;
    const t = 0.15;
    const sep = this._laneSeparatorX; // derived from GLB at init

    // Far end wall (Z=-8, top of table in bbbbbase.glb).
    this.addBoxWall(0, halfH, -halfD, halfW + t, halfH, t);
    // Left outer wall.
    this.addBoxWall(-halfW, halfH, 0, t, halfH, halfD + t);
    // Right outer wall.
    this.addBoxWall(halfW, halfH, 0, t, halfH, halfD + t);
    // Bottom wall for the GLB-derived lane (left side).
    const wallX = sep > 0 ? halfW : -halfW;
    const laneHalfX = Math.abs(wallX - sep) / 2;
    const laneCenterX = (sep + wallX) / 2;
    this.addBoxWall(laneCenterX, halfH, halfD, laneHalfX, halfH, t);
    // Bottom wall for the right lane (spawn side, X=separatorX→halfW).
    const rightSep = PLAYFIELD.launchLane.separatorX; // 3.5
    const rightLaneHalfX = (halfW - rightSep) / 2;   // (4.5-3.5)/2 = 0.5
    const rightLaneCenterX = rightSep + rightLaneHalfX; // 4.0
    this.addBoxWall(rightLaneCenterX, halfH, halfD, rightLaneHalfX, halfH, t);

    // Invisible ceiling (glass top) at Y=2 — enough headroom for flippers/bumpers
    // (which reach up to ~0.6) and the ball (radius 0.2) without crushing them, but
    // low enough to block any wild vertical kick.
    const ceilingY = 2.0;
    this.addBoxWall(0, ceilingY + t, 0, halfW + t, t, halfD + t);
  }

  private addInclinedFloor(solVertices: Float32Array): void {
    // Linear regression: compute slope dY/dZ from the extracted floor vertices.
    // For our inclined table the drain end (Z=+halfD) is lower, far end (Z=-halfD) is higher.
    let sZ = 0, sY = 0, sZZ = 0, sZY = 0, n = 0;
    for (let i = 0; i < solVertices.length; i += 3) {
      const y = solVertices[i + 1]!;
      const z = solVertices[i + 2]!;
      sZ += z; sY += y; sZZ += z * z; sZY += z * y; n++;
    }
    const slope = n > 1 ? (n * sZY - sZ * sY) / (n * sZZ - sZ * sZ) : 0; // dY/dZ, negative

    const tiltAngle = Math.atan(Math.abs(slope)); // always positive angle
    const s = Math.sin(tiltAngle);
    const c = Math.cos(tiltAngle);
    const halfW = PLAYFIELD.width / 2 + 0.2;
    const halfH = 0.5;                                 // 1 unit thick — no tunneling
    const halfD = PLAYFIELD.depth / 2 + 0.2;
    const halfD_local = halfD / c;                     // extend in rotated frame to cover full depth

    // Place the drain edge (box local +Z end) at physics Y=0, Z≈+halfD.
    const centerY = halfD_local * s - halfH * c;

    // Positive rotation around X: drain (+Z) goes down, far end (-Z) goes up.
    const half = tiltAngle / 2;
    const body = this.world.createRigidBody(
      this.r.RigidBodyDesc.fixed()
        .setTranslation(0, centerY, 0)
        .setRotation({ x: Math.sin(half), y: 0, z: 0, w: Math.cos(half) }),
    );
    this.world.createCollider(
      this.r.ColliderDesc.cuboid(halfW, halfH, halfD_local)
        .setFriction(0.1)
        .setRestitution(0.2),
      body,
    );
  }

  private addBoxWall(
    cx: number, cy: number, cz: number,
    hx: number, hy: number, hz: number,
  ): void {
    const body = this.world.createRigidBody(
      this.r.RigidBodyDesc.fixed().setTranslation(cx, cy, cz),
    );
    this.world.createCollider(
      this.r.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.05).setRestitution(0.6),
      body,
    );
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
    const derived = this._flipperPivots?.[side];
    const fallback = side === 'left' ? PLAYFIELD.flippers.left : PLAYFIELD.flippers.right;
    const pivot = derived ?? fallback;
    const sign = side === 'left' ? -1 : 1;
    const restAngle = sign * PLAYFIELD.flippers.restAngle;
    const activeAngle = sign * PLAYFIELD.flippers.activeAngle;
    const dir = side === 'left' ? 1 : -1;
    const halfLength = (derived?.length ?? PLAYFIELD.flippers.length) / 2;

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
    // 4 substeps per tick — reduces tunneling through thin trimesh walls at high speed.
    // Drain inside the loop so a brief contact (start + end within the same tick) still
    // registers — draining only at the end would silently swallow such collision events.
    const subDt = dt / 4;
    this.world.timestep = subDt;
    for (let i = 0; i < 4; i++) {
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
    // Same inline spawn position as init() — right plunger lane, just above the floor.
    this.ballBody.setTranslation({ x: 4.0, y: 0.6, z: 6.0 }, true);
    this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.ballBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  getLaneSeparatorX(): number {
    return this._laneSeparatorX;
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
