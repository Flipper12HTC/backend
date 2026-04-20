import { world, RAPIER } from './world.js';
import { TABLE } from '../../contracts/table.js';

function createWall(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
): void {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z),
  ); 

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2),
    body,
  );
}

export function createTable(): void {
  const { width, depth, wall } = TABLE;

  // Sol
  createWall(0, -0.15, 0, width, 0.3, depth);

  // Mur gauche
  createWall(
    -width / 2,
    wall.height / 2,
    0,
    wall.thickness,
    wall.height,
    depth,
  );

  // Mur droit
  createWall(
    width / 2,
    wall.height / 2,
    0,
    wall.thickness,
    wall.height,
    depth,
  );

  // Mur haut
  createWall(
    0,
    wall.height / 2,
    -depth / 2,
    width,
    wall.height,
    wall.thickness,
  );

  // Mur bas (drain)
  createWall(
    0,
    wall.height / 2,
    depth / 2,
    width,
    wall.height,
    wall.thickness,
  );
}