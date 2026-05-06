export const PLAYFIELD = {
  width: 9,
  depth: 16,
  floorThickness: 0.3,

  wall: {
    height: 1,
    thickness: 0.3,
  },

  flippers: {
    left: { x: -3.5, y: 0.4, z: 5.5 },
    right: { x: 3.5, y: 0.4, z: 5.5 },
    length: 3,
    restAngle: 0.3,
    activeAngle: -0.5,
  },

  ball: {
    radius: 0.2,
    spawn: { x: 0, y: 0.4, z: 0 },
  },

  drain: {
    gap: 2.5,
    yThreshold: -1,
  },
} as const;
