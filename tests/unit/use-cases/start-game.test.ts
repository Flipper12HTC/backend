import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startGame } from '../../../src/application/use-cases/start-game.js';
import type { PhysicsWorld } from '../../../src/application/ports/physics-world.js';
import type { GamePublisher, GameEvent } from '../../../src/application/ports/game-publisher.js';

let resetCalled = false;
let published: GameEvent | null = null;

const mockPhysics: PhysicsWorld = {
  init: async () => {},
  step: () => {},
  getBallPosition: () => ({ x: 0, y: 0, z: 0 }),
  resetBall: () => { resetCalled = true; },
  applyFlipperImpulse: () => {},
};

const mockPublisher: GamePublisher = {
  broadcast: (event) => { published = event; },
};

describe('startGame', () => {
  beforeEach(() => {
    resetCalled = false;
    published = null;
  });

  it('resets the ball', () => {
    startGame(mockPhysics, mockPublisher);
    assert.ok(resetCalled, 'resetBall should be called');
  });

  it('broadcasts a score_update event', () => {
    startGame(mockPhysics, mockPublisher);
    assert.ok(published !== null);
    assert.equal(published!.type, 'score_update');
  });
});
