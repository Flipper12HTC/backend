import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { tickGame } from '../../../src/application/use-cases/tick-game.js';
import type { PhysicsWorld } from '../../../src/application/ports/physics-world.js';
import type { GamePublisher, GameEvent } from '../../../src/application/ports/game-publisher.js';

let stepped = false;
let published: GameEvent | null = null;

const mockPhysics: PhysicsWorld = {
  init: async () => {},
  step: () => { stepped = true; },
  getBallPosition: () => ({ x: 1, y: 2, z: 3 }),
  resetBall: () => {},
  applyFlipperImpulse: () => {},
};

const mockPublisher: GamePublisher = {
  broadcast: (event) => { published = event; },
};

describe('tickGame', () => {
  beforeEach(() => {
    stepped = false;
    published = null;
  });

  it('steps the physics world', () => {
    tickGame(mockPhysics, mockPublisher, 1 / 60);
    assert.ok(stepped, 'physics.step should be called');
  });

  it('broadcasts ball_position with current position', () => {
    tickGame(mockPhysics, mockPublisher, 1 / 60);
    assert.ok(published !== null, 'should broadcast an event');
    assert.equal(published!.type, 'ball_position');
    assert.deepEqual(
      (published as Extract<GameEvent, { type: 'ball_position' }>).payload,
      { x: 1, y: 2, z: 3 },
    );
  });
});
