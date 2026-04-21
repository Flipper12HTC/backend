import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RapierPhysicsWorld } from '../../src/infrastructure/physics/rapier-world.js';

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

  it('ball loses energy and comes to rest', () => {
    for (let i = 0; i < 600; i++) physics.step(DT);
    const pos = physics.getBallPosition();
    assert.ok(pos.y < 1, 'ball should be near floor after 10s');
    assert.ok(pos.y >= 0, 'ball should not fall through floor');
    assert.ok(Math.abs(pos.x) < 8, 'ball should stay within x bounds');
  });
});
