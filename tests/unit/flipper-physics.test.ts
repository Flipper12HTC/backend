import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RapierPhysicsWorld } from '../../src/infrastructure/physics/rapier-world.js';
import { PLAYFIELD } from '../../src/domain/playfield.js';

const DT = 1 / 60;
const physics = new RapierPhysicsWorld();

describe('flipper physics', () => {
  before(async () => {
    await physics.init({ wallHeight: 10 });
  });

  beforeEach(() => {
    // Park the ball outside any flipper before each test, then position it explicitly.
    physics.setBallPosition({ x: 0, y: 5, z: 0 });
    physics.setFlipperActive('left', false);
    physics.setFlipperActive('right', false);
    // Let flippers settle back to rest (kinematic interpolation needs a few ticks).
    for (let i = 0; i < 30; i++) physics.step(DT);
    physics.consumeFlipperHits();
  });

  it('left flipper push sends the ball upward (z decreases) and registers a hit', () => {
    const flipper = PLAYFIELD.flippers.left;
    // Place the ball just above the flipper tip, slightly inboard of the pivot.
    // The left flipper extends in +X from its pivot at rest (angle ~ -0.3 rad about Y).
    physics.setBallPosition({
      x: flipper.x + 1.0,
      y: flipper.y + 0.6,
      z: flipper.z,
    });

    // Let the ball settle on top of the resting flipper.
    for (let i = 0; i < 20; i++) physics.step(DT);
    const beforePush = physics.getBallPosition();
    physics.consumeFlipperHits();

    // Activate the flipper and step ~150ms.
    physics.setFlipperActive('left', true);
    for (let i = 0; i < 9; i++) physics.step(DT);
    const afterPush = physics.getBallPosition();

    assert.ok(
      afterPush.z < beforePush.z,
      `ball z should decrease (upward in playfield): before=${beforePush.z.toFixed(3)} after=${afterPush.z.toFixed(3)}`,
    );
    assert.ok(
      physics.consumeFlipperHits() > 0,
      'collision events should report at least one flipper hit',
    );
  });

  it('right flipper push sends the ball upward (z decreases)', () => {
    const flipper = PLAYFIELD.flippers.right;
    physics.setBallPosition({
      x: flipper.x - 1.0,
      y: flipper.y + 0.6,
      z: flipper.z,
    });

    for (let i = 0; i < 20; i++) physics.step(DT);
    const beforePush = physics.getBallPosition();

    physics.setFlipperActive('right', true);
    for (let i = 0; i < 9; i++) physics.step(DT);
    const afterPush = physics.getBallPosition();

    assert.ok(
      afterPush.z < beforePush.z,
      `ball z should decrease: before=${beforePush.z.toFixed(3)} after=${afterPush.z.toFixed(3)}`,
    );
  });

  it('flipper returns to rest after release', () => {
    const flipper = PLAYFIELD.flippers.left;
    physics.setBallPosition({
      x: flipper.x + 1.0,
      y: flipper.y + 0.6,
      z: flipper.z,
    });
    for (let i = 0; i < 20; i++) physics.step(DT);

    physics.setFlipperActive('left', true);
    for (let i = 0; i < 9; i++) physics.step(DT);
    physics.setFlipperActive('left', false);
    // Plenty of time for the kinematic rotation to interpolate back to rest.
    for (let i = 0; i < 30; i++) physics.step(DT);

    // The ball is no longer being driven by the flipper: it should fall back
    // under gravity rather than keep being lifted.
    const settled = physics.getBallPosition();
    for (let i = 0; i < 30; i++) physics.step(DT);
    const later = physics.getBallPosition();
    assert.ok(later.y <= settled.y + 0.1, 'ball should not keep rising after release');
  });
});
