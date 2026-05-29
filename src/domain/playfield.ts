export const PLAYFIELD = {
  width: 9,
  depth: 16,
  floorThickness: 0.3,

  // Inner playable area — measured from pinball_map_FINAL.glb after scaling.
  interior: {
    halfWidth: 4.3,
    halfDepth: 7.8,
  },

  wall: {
    height: 5.3,
    thickness: 0.17,
  },

  cornerRadius: 1.5,

  // Right-side launch lane (plunger). Ball enters main field from top-right.
  launchLane: {
    separatorX: 3.5,
    zMin: -8,
    zMax: 8,
  },

  // Pivot positions extracted from pinball_map_v4.glb (GLB Z-up coordinate remapping).
  // Left  pivot = left  wall attachment; collider extends RIGHT (toward centre).
  // Right pivot = right wall attachment; collider extends LEFT  (toward centre).
  flippers: {
    left: { x: -1.74, y: 0.40, z: 6.574 },
    right: { x: 1.53, y: 0.51, z: 6.609 },
    length: 3.27,
    restAngle: 0.3,
    activeAngle: -0.5,
  },

  ball: {
    radius: 0.2,
    spawn: { x: 4.0, y: 0.5, z: 5.0 },
  },

  // Positions extracted from bumper_group_mesh (4 large) + bumper_mini_mesh (2 small).
  // Physics space: drain = +Z, far end = -Z, left = -X, right = +X.
  bumpers: [
    // bumper_group — 4 cylindrical bumpers near upper half of table
    { id: 'b1', x: -0.02, z: -2.98, radius: 0.4, scale: 1 },
    { id: 'b2', x: -0.84, z: -3.94, radius: 0.4, scale: 1 },
    { id: 'b3', x: 0.83, z: -4.18, radius: 0.4, scale: 1 },
    { id: 'b4', x: -3.18, z: -6.35, radius: 0.4, scale: 1 },
    // bumper_mini — 2 smaller obstacles in the lower-middle section
    { id: 'bm1', x: -0.12, z: 3.72, radius: 0.3, scale: 1 },
    { id: 'bm2', x: -1.87, z: 0.03, radius: 0.3, scale: 1 },
  ],

  drain: {
    gap: 2.5,
    yThreshold: -1,
  },

  // Impulse applied when the ball is put into play (game start + respawn after drain).
  // Sends the ball toward the upper bumper cluster.
  serve: {
    impulse: { x: -1.5, y: 0, z: -5 },
  },
} as const;
