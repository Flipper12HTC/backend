import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld, getBallPosition, resetBall } from '../../src/game/physics.js';
import { createPlayfield } from '../../src/game/playfield.js';

const DT = 1 / 60;

describe('ball physics', () => {
  before(async () => {
    await createWorld({ restitution: 0.7 });
    createPlayfield({ wallHeight: 10 });
  });

  beforeEach(() => {
    resetBall();
  });

  it('ball falls under gravity', () => {
    const start = getBallPosition();
    for (let i = 0; i < 10; i++) stepWorld(DT);
    const after = getBallPosition();
    assert.ok(after.y < start.y, 'ball should fall');
  });

  it('ball bounces off floor', () => {
    for (let i = 0; i < 120; i++) stepWorld(DT);
    const pos = getBallPosition();
    assert.ok(pos.y >= 0, 'ball should not go below floor');
  });

  it('ball loses energy and comes to rest', () => {
    for (let i = 0; i < 600; i++) stepWorld(DT);
    const pos = getBallPosition();
    assert.ok(pos.y < 1, 'ball should be near floor after 10s');
    assert.ok(pos.y >= 0, 'ball should not fall through floor');
    assert.ok(Math.abs(pos.x) < 8, 'ball should stay within x bounds');
  });
});
