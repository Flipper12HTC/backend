import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { handleFlipperPress } from '../../../src/application/use-cases/handle-flipper-press.js';
import type { PhysicsWorld } from '../../../src/application/ports/physics-world.js';
import type { FlipperSide } from '../../../src/domain/flipper.js';

let impulseApplied: FlipperSide | null = null;

const mockPhysics: PhysicsWorld = {
  init: async () => {},
  step: () => {},
  getBallPosition: () => ({ x: 0, y: 0, z: 0 }),
  resetBall: () => {},
  applyFlipperImpulse: (side) => { impulseApplied = side; },
};

describe('handleFlipperPress', () => {
  beforeEach(() => { impulseApplied = null; });

  it('applies impulse on left flipper', () => {
    handleFlipperPress(mockPhysics, 'left');
    assert.equal(impulseApplied, 'left');
  });

  it('applies impulse on right flipper', () => {
    handleFlipperPress(mockPhysics, 'right');
    assert.equal(impulseApplied, 'right');
  });
});
