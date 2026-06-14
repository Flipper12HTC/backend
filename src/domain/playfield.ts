export const PLAYFIELD = {
  width: 9,
  depth: 16,
  floorThickness: 0.3,

  // Inner playable area — where the GLB walls actually start (Sol_Mesh edge).
  // Measured from `BaseFlipper.glb` after front scaling to width/depth.
  interior: {
    halfWidth: 4.33,
    halfDepth: 7.8,
  },

  wall: {
    height: 1.4,
    thickness: 0.17,
  },

  cornerRadius: 1.5,

  launchLane: {
    separatorX: 3.7,
    zMin: -2,
    zMax: 8,
  },

  flippers: {
    left: { x: -2.5, y: 0.4, z: 5.5 },
    right: { x: 2.3, y: 0.4, z: 5.5 },
    length: 2.1,
    restAngle: 0.3,
    activeAngle: -0.5,
  },

  ball: {
    radius: 0.2,
    // y must sit above Sol surface (Sol top ≈ 0.311 in TABLE coords).
    spawn: { x: 4.1, y: 0.55, z: 7.65 },
  },

  bumpers: [
    { id: 'b1', x: -1.5, z: -3, radius: 0.5, scale: 1 },
    { id: 'b2', x: 1.5, z: -3, radius: 0.5, scale: 1 },
    { id: 'b3', x: 0, z: -5, radius: 0.5, scale: 1.2 },
  ],

  drain: {
    gap: 2.5,
    yThreshold: -1,
  },
} as const;
