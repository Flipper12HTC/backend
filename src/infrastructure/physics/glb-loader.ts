import { NodeIO } from '@gltf-transform/core';

export interface MeshGeometry {
  vertices: Float32Array;
  indices: Uint32Array;
}

export interface FlipperPivot {
  x: number;
  y: number;
  z: number;
  length: number;
}

export interface BumperPosition {
  id: string;       // derived from the mesh name suffix
  x: number;        // physics X
  z: number;        // physics Z
  radius: number;   // cylinder radius in physics units
}

export interface DerivedPositions {
  flipperLeft: FlipperPivot;
  flipperRight: FlipperPivot;
  laneSeparatorX: number;       // inner edge of plunger lane wall (separator between lane & field)
  laneSpawnX: number;           // centre X of the plunger lane
  bumpers: BumperPosition[];    // procedural bumpers — auto-collected from col_bumper_marker_* meshes
}

export interface PlayfieldGeometry {
  sol: MeshGeometry;
  murs: MeshGeometry;
  aprons: MeshGeometry | null;
  rampe: MeshGeometry | null;
  derived: DerivedPositions;
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

  // GLB is Y-up (standard glTF, "+Y Up" on export): GLB X = width, GLB Y = elevation,
  // GLB Z = depth. The frontend (Three.js, Y-up) renders this natively; the physics
  // space is Y-up too (width=X, height=Y, depth=Z) so the remap is now near-identity.
  const glbW = sceneMaxX - sceneMinX; // table width in GLB units (X)
  const glbD = sceneMaxZ - sceneMinZ; // table depth in GLB units (Z axis)
  const scaleX = opts.targetWidth / glbW;
  const scaleZ = opts.targetDepth / glbD; // used for GLB Z → physics Z
  const scaleY = (scaleX + scaleZ) / 2; // used for GLB Y → physics Y (height)

  const centerX = (sceneMinX + sceneMaxX) * 0.5 * scaleX;
  const centerZ = (sceneMinZ + sceneMaxZ) * 0.5 * scaleZ; // depth center from GLB Z range
  const baseOffsetY = -sceneMinY * scaleY; // align floor elevation (GLB Y) to physics Y = 0

  // Transform one GLB vertex to physics space.
  const toPhysics = (
    gx: number,
    gy: number,
    gz: number,
  ): [number, number, number] => [
    gx * scaleX - centerX,
    gy * scaleY + baseOffsetY, // GLB Y → physics Y (elevation)
    gz * scaleZ - centerZ, // GLB Z → physics Z (depth). No mirror: keeps triangle
    // winding (floor normals stay +Y) and puts the drain end at +Z.
  ];

  const extractMesh = (
    matchNames: string | readonly string[],
    triangleFilter?: (
      a: [number, number, number],
      b: [number, number, number],
      c: [number, number, number],
    ) => boolean,
    vertexTransform?: (v: [number, number, number]) => [number, number, number],
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
          const p = toPhysics(
            arr[i * 3] as number,
            arr[i * 3 + 1] as number,
            arr[i * 3 + 2] as number,
          );
          tVerts.push(vertexTransform ? vertexTransform(p) : p);
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

  // Plunger lane exclusion zone — any wall triangle whose centroid lies inside this
  // box is dropped, so no GLB geometry can trap the ball in the corridor. The lane
  // separator box wall + the right outer boundary box wall handle the corridor's
  // collision cleanly on their own.
  const LANE_X_MIN = 3.4;     // just past the lane separator
  const LANE_X_MAX = 4.55;    // just past the right outer boundary
  const LANE_Z_MIN = -8.2;
  const LANE_Z_MAX = 8.2;
  const inLane = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ): boolean => {
    const cx = (a[0] + b[0] + c[0]) / 3;
    const cz = (a[2] + b[2] + c[2]) / 3;
    return cx > LANE_X_MIN && cx < LANE_X_MAX && cz > LANE_Z_MIN && cz < LANE_Z_MAX;
  };

  // Murs: keep only vertical-ish faces (|physics Y normal| < 0.5), AND outside the
  // plunger lane (so no surprise mesh wall traps the ball going up the corridor).
  const keepMursTri = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ): boolean => {
    if (inLane(a, b, c)) return false;
    const n = normal(a, b, c);
    if (!n) return false;
    return Math.abs(n[1]) <= 0.5;
  };

  // Wall meshes — vertical faces become physical collision surfaces (filtered by keepMursTri).
  // Patterns are matched as substrings against mesh names in the GLB.
  // Adding a `col_wall_*` or `col_ref_*` family in Blender is enough — register here once
  // so the loader auto-collects every mesh whose name contains the substring.
  // Conservative wall list: only meshes we KNOW form clean vertical walls.
  // Reference meshes (col_ref_flipper / col_ref_plunger / col_ref_floor) are excluded
  // because their geometry often has sharp interior angles that trap the ball mid-air.
  // The lane separator + ceiling already prevent the ball from escaping the playfield,
  // so the rails aren't structurally necessary.
  const WALL_MESHES = [
    'col_wall_frame',         // col_wall_frame_black + col_wall_frame_003..009
    'col_wall_main_outer',
    'col_wall_shooter',
    'col_wall_panel',
    'col_wall_left_fill',
    'col_wall_slingshots',
    'col_wall_flipper',       // col_wall_flipper_* — wall pieces around the flippers
    // col_wall_plunger_lane intentionally omitted — addLaneSeparator() builds a clean box wall.
    // col_wall_apron is in ALL_FACE_MESHES (its slanted faces would otherwise create
    // sharp launchpads under keepMursTri that catapult the ball into the ceiling).
    'col_bumper_mini',
    'col_bumper_targets',     // col_bumper_targets + col_bumper_targets_tiny + col_bumper_targets_group
    'col_ref_deco',           // col_ref_deco_*
    'col_ref_wall',           // col_ref_wall_*
    // col_wall_apron extracted separately (APRON_MESHES) — its bottom edge floats above
    // the floor (apron_2 sits at Y=0.31), letting the ball roll UNDER it. The dedicated
    // extraction drops the bottom band to the floor so the wall actually blocks the ball.
  ] as const;

  // Apron walls: same vertical-face filter as the other walls, but the bottom edge is
  // pulled down to the floor (Y = -0.1) so there is no gap for the ball to pass under.
  // Threshold 0.5 is safely between the apron bottoms (0.12–0.31) and tops (1.5+).
  const APRON_MESHES = ['col_wall_apron'] as const;
  const dropApronBottom = (v: [number, number, number]): [number, number, number] =>
    v[1] < 0.5 ? [v[0], -0.1, v[2]] : v;

  // Meshes extracted with ALL triangles (no normal filter) — ramps whose sloped
  // surfaces need to be walked through.
  // Apron meshes are intentionally NOT loaded — their tops support the ball and
  // trap it above the floor. The boundary box walls already close the drain area.
  const ALL_FACE_MESHES = [
    'col_ramp_main',
  ] as const;

  // Extract all-face meshes (ramps + slanted apron walls) — full geometry, no filter.
  let rampe: MeshGeometry | null = null;
  try {
    rampe = extractMesh(ALL_FACE_MESHES);
  } catch {
    // None of the all-face meshes present in this GLB — not an error.
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

  // --- Derive positions from named GLB nodes ---
  function nodeBbox(
    nodeName: string,
  ): { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number } | null {
    const node = root.listNodes().find((n) => n.getName() === nodeName);
    const mesh = node?.getMesh();
    if (!mesh) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const arr = pos.getArray();
      if (!arr) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        const [px, py, pz] = toPhysics(arr[i * 3] as number, arr[i * 3 + 1] as number, arr[i * 3 + 2] as number);
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
        if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;
      }
    }
    if (!isFinite(minX)) return null;
    return { minX, maxX, minY, maxY, minZ, maxZ };
  }

  const bbFL = nodeBbox('flipper_left');
  const bbFR = nodeBbox('flipper_right');
  const bbLane = nodeBbox('col_wall_plunger_lane');

  if (!bbFL || !bbFR) throw new Error('flipper_left / flipper_right nodes missing from GLB');

  // Left flipper: pivot at min X (wall-attachment edge), right flipper at max X.
  const flipperLeft: FlipperPivot = {
    x: bbFL.minX,
    y: bbFL.minY,
    z: (bbFL.minZ + bbFL.maxZ) / 2,
    length: bbFL.maxX - bbFL.minX,
  };
  const flipperRight: FlipperPivot = {
    x: bbFR.maxX,
    y: bbFR.minY,
    z: (bbFR.minZ + bbFR.maxZ) / 2,
    length: bbFR.maxX - bbFR.minX,
  };

  // Lane separator: inner edge of the plunger lane wall (edge closest to main field).
  const halfW = opts.targetWidth / 2;
  const laneSeparatorX = bbLane
    ? Math.abs(bbLane.maxX) < Math.abs(bbLane.minX)
      ? bbLane.maxX   // lane on left → inner edge is positive (toward centre)
      : bbLane.minX   // lane on right → inner edge is negative (toward centre)
    : halfW - 1;      // fallback: 1 unit from right wall
  const laneSpawnX = bbLane ? (bbLane.minX + bbLane.maxX) / 2 : halfW - 0.5;

  // Bumpers — auto-collected from every mesh whose name starts with `col_bumper_marker_`.
  // Each marker is a small mesh in Blender whose bounding box encodes:
  //   - centre (X, Z) in physics units → bumper position
  //   - half-width on X/Z axes        → bumper cylinder radius
  // To add/move a bumper, edit the marker mesh in Blender — no code change needed.
  const bumpers: BumperPosition[] = [];
  for (const mesh of root.listMeshes()) {
    const name = mesh.getName() ?? '';
    if (!name.startsWith('col_bumper_marker_')) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const arr = pos.getArray();
      if (!arr) continue;
      for (let i = 0; i < pos.getCount(); i++) {
        const [px, , pz] = toPhysics(
          arr[i * 3] as number,
          arr[i * 3 + 1] as number,
          arr[i * 3 + 2] as number,
        );
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;
      }
    }
    if (!isFinite(minX)) continue;
    bumpers.push({
      id: name.replace('col_bumper_marker_', ''),
      x: (minX + maxX) / 2,
      z: (minZ + maxZ) / 2,
      radius: Math.max((maxX - minX) / 2, (maxZ - minZ) / 2),
    });
  }

  let aprons: MeshGeometry | null = null;
  try {
    aprons = extractMesh(APRON_MESHES, keepMursTri, dropApronBottom);
  } catch {
    // No apron meshes in this GLB — not an error.
  }

  return {
    sol: extractMesh(floorMeshNames, keepSolTri),
    murs: extractMesh(WALL_MESHES, keepMursTri),
    aprons,
    rampe,
    derived: { flipperLeft, flipperRight, laneSeparatorX, laneSpawnX, bumpers },
  };
}
