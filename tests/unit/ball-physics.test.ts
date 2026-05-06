import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RapierPhysicsWorld } from '../../src/infrastructure/physics/rapier-world.js';
import { PLAYFIELD } from '../../src/domain/playfield.js';

const DT = 1 / 60;
const physics = new RapierPhysicsWorld();

describe('ball physics', () => {
  before(async () => {
    await physics.init({ restitution: 0.7, wallHeight: 10 });
  });

  beforeEach(() => {
    physics.resetBall();
  });

  it('ball falls under gravity', () => {
    const start = physics.getBallPosition();
    for (let i = 0; i < 10; i++) physics.step(DT);
    const after = physics.getBallPosition();
    assert.ok(after.y < start.y, 'ball should fall');
  });

  it('ball bounces off floor', () => {
    for (let i = 0; i < 120; i++) physics.step(DT);
    const pos = physics.getBallPosition();
    assert.ok(pos.y >= 0, 'ball should not go below floor');
  });

  it('ball stays within x bounds (side walls intact)', () => {
    for (let i = 0; i < 120; i++) physics.step(DT);
    const pos = physics.getBallPosition();
    assert.ok(Math.abs(pos.x) < PLAYFIELD.width / 2, `ball.x ${pos.x.toFixed(2)} out of bounds`);
  });

  it('ball can drain through bottom gap (drifts past z = depth/2)', () => {
    let drained = false;
    for (let i = 0; i < 600; i++) {
      physics.step(DT);
      const pos = physics.getBallPosition();
      if (pos.z > PLAYFIELD.depth / 2 || pos.y < PLAYFIELD.drain.yThreshold) {
        drained = true;
        break;
      }
    }
    assert.ok(drained, 'ball should reach drain area within 10s under gravity z');
  });
});
