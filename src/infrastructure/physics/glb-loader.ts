import { NodeIO } from '@gltf-transform/core';

export interface MeshGeometry {
  vertices: Float32Array;
  indices: Uint32Array;
}

export interface PlayfieldGeometry {
  sol: MeshGeometry;
  murs: MeshGeometry;
}

export interface LoadOptions {
  targetWidth: number;
  targetDepth: number;
}

/**
 * Load playfield meshes from a GLB and apply the same scale/center transform
 * the front-end uses when adding the model to the Three.js scene:
 *   1. Compute scene bbox.
 *   2. Scale x→targetWidth/sceneW, z→targetDepth/sceneD, y=avg(sx,sz).
 *   3. Center on x and z.
 *   4. Align bottom (min.y) to y=0.
 *
 * Returns Sol_Mesh and Murs_Mesh as flat vertex/index arrays suitable for
 * Rapier `ColliderDesc.trimesh(vertices, indices)`.
 */
export async function loadPlayfieldGeometry(
  path: string,
  opts: LoadOptions,
): Promise<PlayfieldGeometry> {
  const io = new NodeIO();
  const doc = await io.read(path);
  const root = doc.getRoot();

  let sceneMinX = Infinity,
    sceneMinY = Infinity,
    sceneMinZ = Infinity;
  let sceneMaxX = -Infinity,
    sceneMaxY = -Infinity,
    sceneMaxZ = -Infinity;

  const meshNodes = root.listNodes().filter((n) => n.getMesh() !== null);
  for (const node of meshNodes) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const arr = pos.getArray();
      if (!arr) continue;
      const count = pos.getCount();
      for (let i = 0; i < count; i++) {
        const x = arr[i * 3] as number;
        const y = arr[i * 3 + 1] as number;
        const z = arr[i * 3 + 2] as number;
        if (x < sceneMinX) sceneMinX = x;
        if (y < sceneMinY) sceneMinY = y;
        if (z < sceneMinZ) sceneMinZ = z;
        if (x > sceneMaxX) sceneMaxX = x;
        if (y > sceneMaxY) sceneMaxY = y;
        if (z > sceneMaxZ) sceneMaxZ = z;
      }
    }
  }

  const sceneW = sceneMaxX - sceneMinX;
  const sceneD = sceneMaxZ - sceneMinZ;
  const sx = opts.targetWidth / sceneW;
  const sz = opts.targetDepth / sceneD;
  const sy = (sx + sz) / 2;
  const centerX = (sceneMinX + sceneMaxX) * 0.5 * sx;
  const centerZ = (sceneMinZ + sceneMaxZ) * 0.5 * sz;
  const baseOffsetY = -sceneMinY * sy;

  const extractMesh = (
    matchName: string,
    triangleFilter?: (
      a: [number, number, number],
      b: [number, number, number],
      c: [number, number, number],
    ) => boolean,
  ): MeshGeometry => {
    const verts: number[] = [];
    const idx: number[] = [];
    let vertOffset = 0;
    for (const mesh of root.listMeshes()) {
      const name = mesh.getName() ?? '';
      if (!name.includes(matchName)) continue;
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const arr = pos.getArray();
        if (!arr) continue;
        const count = pos.getCount();
        // Transform vertices.
        const tVerts: [number, number, number][] = [];
        for (let i = 0; i < count; i++) {
          const x = (arr[i * 3] as number) * sx - centerX;
          const y = (arr[i * 3 + 1] as number) * sy + baseOffsetY;
          const z = (arr[i * 3 + 2] as number) * sz - centerZ;
          tVerts.push([x, y, z]);
        }
        const indices = prim.getIndices();
        const ia = indices?.getArray();
        const triCount = ia ? ia.length / 3 : count / 3;
        const kept = new Set<number>();
        const keepTri: number[] = [];
        for (let t = 0; t < triCount; t++) {
          const i0 = ia ? (ia[t * 3] as number) : t * 3;
          const i1 = ia ? (ia[t * 3 + 1] as number) : t * 3 + 1;
          const i2 = ia ? (ia[t * 3 + 2] as number) : t * 3 + 2;
          const a = tVerts[i0]!;
          const b = tVerts[i1]!;
          const c = tVerts[i2]!;
          if (triangleFilter && !triangleFilter(a, b, c)) continue;
          keepTri.push(i0, i1, i2);
          kept.add(i0);
          kept.add(i1);
          kept.add(i2);
        }
        // Remap kept vertex indices to new compact range.
        const remap = new Map<number, number>();
        for (const oldIdx of kept) {
          const newIdx = vertOffset + remap.size;
          remap.set(oldIdx, newIdx);
          const v = tVerts[oldIdx]!;
          verts.push(v[0], v[1], v[2]);
        }
        for (const oldIdx of keepTri) idx.push(remap.get(oldIdx)!);
        vertOffset += remap.size;
      }
    }
    if (verts.length === 0) {
      throw new Error(`Mesh '${matchName}' not found in GLB`);
    }
    return {
      vertices: new Float32Array(verts),
      indices: new Uint32Array(idx),
    };
  };

  function normal(
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ): [number, number, number] | null {
    const e1x = b[0] - a[0],
      e1y = b[1] - a[1],
      e1z = b[2] - a[2];
    const e2x = c[0] - a[0],
      e2y = c[1] - a[1],
      e2z = c[2] - a[2];
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (nl === 0) return null;
    return [nx / nl, ny / nl, nz / nl];
  }

  // Sol: only keep upward-facing triangles (the top surface).
  // Drops bottom/side faces of the floor mesh that would act as phantom walls.
  const keepSolTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ): boolean => {
    const n = normal(a, b, c);
    if (!n) return false;
    return n[1] > 0.7;
  };

  // Murs: keep only vertical-ish faces (actual walls).
  // Drops any top/bottom horizontal triangles inside the wall mesh.
  // Also drops the plunger-pocket front wall so the ball can launch.
  const keepMursTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ): boolean => {
    const n = normal(a, b, c);
    if (!n) return false;
    if (Math.abs(n[1]) > 0.5) return false; // horizontal face, not a wall

    const cxT = (a[0] + b[0] + c[0]) / 3;
    const cyT = (a[1] + b[1] + c[1]) / 3;
    const czT = (a[2] + b[2] + c[2]) / 3;
    // Plunger pocket front: drop z-facing walls above floor in launch lane.
    if (cxT > 3.5 && czT > 7.45 && czT < 7.75 && Math.abs(n[2]) > 0.7 && cyT > 0.4) {
      return false;
    }
    return true;
  };

  return {
    sol: extractMesh('Sol', keepSolTri),
    murs: extractMesh('Murs', keepMursTri),
  };
}
