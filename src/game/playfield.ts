import { getWorld, getRapier } from './physics.js';
import { TABLE } from '../../contracts/table.js';

function createWall(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const world = getWorld() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const RAPIER = getRapier() as any;

  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z),
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2),
    body,
  );
}

export interface PlayfieldOptions {
  wallHeight?: number;
}

export function createPlayfield(options: PlayfieldOptions = {}): void {
  const { width, depth, floorThickness, wall } = TABLE;
  const h = options.wallHeight ?? wall.height;

  createWall(0, -floorThickness / 2, 0, width, floorThickness, depth);
  createWall(-width / 2, h / 2, 0, wall.thickness, h, depth);
  createWall(width / 2, h / 2, 0, wall.thickness, h, depth);
  createWall(0, h / 2, -depth / 2, width, h, wall.thickness);
  createWall(0, h / 2, depth / 2, width, h, wall.thickness);
}
