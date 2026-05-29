import { NodeIO } from '@gltf-transform/core';

export interface MeshGeometry {
  vertices: Float32Array;
  indices: Uint32Array;
}

export interface PlayfieldGeometry {
  sol: MeshGeometry;
  murs: MeshGeometry;
  rampe: MeshGeometry | null;
}

export interface LoadOptions {
  targetWidth: number;
  targetDepth: number;
}

/**
 * Load playfield meshes from pinball_map_FINAL.glb.
 *
 * Coordinate remapping (GLB uses Z-up, Blender XY plane = table surface):
 *   GLB X → physics X  (table width, left-right)
 *   GLB Z → physics Y  (elevation / height, Z-up in GLB → Y-up in Rapier)
 *   GLB Y → physics Z  (table depth, negated so drain = +Z)
 *
 * Scale / centering applied:
 *   1. Compute bbox from physics-relevant meshes only.
 *   2. scaleX = targetWidth  / glbXRange
 *      scaleZ = targetDepth  / glbYRange  (GLB Y = depth)
 *      scaleY = avg(scaleX, scaleZ)        (height preserves aspect ratio)
 *   3. Center on physics X and Z.
 *   4. Align floor (glbZ min) to physics Y = 0.
 */
export async function loadPlayfieldGeometry(
  path: string,
  opts: LoadOptions,
): Promise<PlayfieldGeometry> {
  const io = new NodeIO();
  const doc = await io.read(path);
  const root = doc.getRoot();

  // Only these meshes drive the scene bounding box used for scaling.
  // col_floor_playfield_blue spans the full table (X:0→28.58, Y:-0.92→50.62, depth=51.53)
  // matching the frontend scene bbox — keeps physics/visual coords aligned.
  const BBOX_MESHES = ['col_floor_playfield_blue', 'flipper_left', 'flipper_right'];

  let sceneMinX = Infinity,
    sceneMinY = Infinity,
    sceneMinZ = Infinity;
  let sceneMaxX = -Infinity,
    sceneMaxY = -Infinity,
    sceneMaxZ = -Infinity;

  const meshNodes = root.listNodes().filter((n) => n.getMesh() !== null);
  for (const node of meshNodes) {
    const name = node.getName() ?? '';
    if (!BBOX_MESHES.some((m) => name.includes(m))) continue;
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

  // GLB X = width, GLB Y = depth (drain at small Y, far end at large Y), GLB Z = elevation.
  const glbW = sceneMaxX - sceneMinX; // table width in GLB units
  const glbD = sceneMaxY - sceneMinY; // table depth in GLB units (GLB Y axis)
  const scaleX = opts.targetWidth / glbW;
  const scaleZ = opts.targetDepth / glbD; // used for GLB Y → physics Z
  const scaleY = (scaleX + scaleZ) / 2; // used for GLB Z → physics Y (height)

  const centerX = (sceneMinX + sceneMaxX) * 0.5 * scaleX;
  const centerZ = (sceneMinY + sceneMaxY) * 0.5 * scaleZ; // depth center from GLB Y range
  const baseOffsetY = -sceneMinZ * scaleY; // align floor elevation to physics Y = 0

  // Transform one GLB vertex to physics space.
  const toPhysics = (
    gx: number,
    gy: number,
    gz: number,
  ): [number, number, number] => [
    gx * scaleX - centerX,
    gz * scaleY + baseOffsetY,
    centerZ - gy * scaleZ, // GLB Y negated → drain end = +Z
  ];

  const extractMesh = (
    matchNames: string | readonly string[],
    triangleFilter?: (
      a: [number, number, number],
      b: [number, number, number],
      c: [number, number, number],
    ) => boolean,
  ): MeshGeometry => {
    const patterns = Array.isArray(matchNames) ? matchNames : [matchNames];
    const verts: number[] = [];
    const idx: number[] = [];
    let vertOffset = 0;
    for (const mesh of root.listMeshes()) {
      const name = mesh.getName() ?? '';
      if (!patterns.some((p) => name.includes(p))) continue;
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const arr = pos.getArray();
        if (!arr) continue;
        const count = pos.getCount();

        const tVerts: [number, number, number][] = [];
        for (let i = 0; i < count; i++) {
          tVerts.push(
            toPhysics(
              arr[i * 3] as number,
              arr[i * 3 + 1] as number,
              arr[i * 3 + 2] as number,
            ),
          );
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
      throw new Error(`Mesh '${patterns.join(', ')}' not found in GLB`);
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

  // Sol: keep only upward-facing triangles (physics Y-up normal > 0.7).
  const keepSolTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ): boolean => {
    const n = normal(a, b, c);
    if (!n) return false;
    return n[1] > 0.7;
  };

  // Murs: keep only vertical-ish faces (|physics Y normal| < 0.5).
  const keepMursTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ): boolean => {
    const n = normal(a, b, c);
    if (!n) return false;
    return Math.abs(n[1]) <= 0.5;
  };

  // Wall meshes — vertical faces forming physical collision surfaces.
  // Patterns are matched as substrings against mesh names in the GLB.
  const WALL_MESHES = [
    'col_wall_frame',      // col_wall_frame_black (outer frame + main walls)
    'col_wall_shooter',
    'col_wall_panel',
    'col_wall_slingshots',
    'col_bumper_mini',
    'col_wall_plunger_lane',
    'col_ref_deco',        // matches all col_ref_deco_001…082
    'col_bumper_targets',  // matches col_bumper_targets + col_bumper_targets_tiny
    'col_ref_plunger_star',
  ] as const;

  // Ramp: extract all triangles (sloped + vertical sides) so the ball follows the channel.
  let rampe: MeshGeometry | null = null;
  try {
    rampe = extractMesh('col_ramp_main');
  } catch {
    // No ramp mesh in this GLB — not an error.
  }

  // Floor meshes — automatically collect every col_floor_* mesh except col_floor_base.
  // Adding col_floor_* in Blender is enough; no code change needed.
  const floorMeshNames = root
    .listMeshes()
    .map((m) => m.getName() ?? '')
    .filter((n) => n.startsWith('col_floor_') && !n.includes('base'));
  if (floorMeshNames.length === 0) {
    throw new Error('No col_floor_* meshes found in GLB');
  }

  return {
    sol: extractMesh(floorMeshNames, keepSolTri),
    murs: extractMesh(WALL_MESHES, keepMursTri),
    rampe,
  };
}
