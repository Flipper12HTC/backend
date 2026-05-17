export const PLAYFIELD = {
  width: 9,
  depth: 16,
  floorThickness: 0.3,

  wall: {
    height: 1,
    thickness: 0.3,
  },

  cornerRadius: 2,

  launchLane: {
    separatorX: 3.7,
    zMin: -2,
    zMax: 8,
  },

  flippers: {
    left: { x: -2.5, y: 0.4, z: 5.5 },
    right: { x: 2.5, y: 0.4, z: 5.5 },
    length: 2.1,
    restAngle: 0.3,
    activeAngle: -0.5,
  },

  ball: {
    radius: 0.2,
    spawn: { x: 4.1, y: 0.2, z: 7.65 },
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
