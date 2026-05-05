import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startGame } from '../../../src/application/use-cases/start-game.js';
import { createInitialState } from '../../../src/domain/game.js';
import type { PhysicsWorld } from '../../../src/application/ports/physics-world.js';
import type { GamePublisher, GameEvent } from '../../../src/application/ports/game-publisher.js';

let resetCalled = false;
let published: GameEvent | null = null;

const mockPhysics: PhysicsWorld = {
  init: async () => {},
  step: () => {},
  getBallPosition: () => ({ x: 0, y: 0, z: 0 }),
  resetBall: () => {
    resetCalled = true;
  },
  applyFlipperImpulse: () => {},
};

const mockPublisher: GamePublisher = {
  broadcast: (event) => {
    published = event;
  },
};

describe('startGame', () => {
  beforeEach(() => {
    resetCalled = false;
    published = null;
  });

  it('passes status to running and resets counters', () => {
    const state = createInitialState();
    state.status = 'over';
    state.score = 999;
    state.ballsLeft = 0;
    state.multiplier = 5;

    startGame(state, mockPhysics, mockPublisher);

    assert.equal(state.status, 'running');
    assert.equal(state.score, 0);
    assert.equal(state.ballsLeft, 3);
    assert.equal(state.multiplier, 1);
    assert.equal(state.activeFlipper, null);
    assert.ok(state.startedAt !== null);
    assert.equal(state.endedAt, null);
  });

  it('resets the ball', () => {
    startGame(createInitialState(), mockPhysics, mockPublisher);
    assert.ok(resetCalled, 'resetBall should be called');
  });

  it('broadcasts score_update with initial counters', () => {
    startGame(createInitialState(), mockPhysics, mockPublisher);
    assert.ok(published !== null);
    assert.equal(published!.type, 'score_update');
    assert.deepEqual(
      (published as Extract<GameEvent, { type: 'score_update' }>).payload,
      { score: 0, ballsLeft: 3, multiplier: 1 },
    );
  });
});
