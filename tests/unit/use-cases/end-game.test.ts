import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { endGame } from '../../../src/application/use-cases/end-game.js';
import { createInitialState } from '../../../src/domain/game.js';
import type { GamePublisher, GameEvent } from '../../../src/application/ports/game-publisher.js';

let published: GameEvent | null = null;

const mockPublisher: GamePublisher = {
  broadcast: (event) => {
    published = event;
  },
};

describe('endGame', () => {
  beforeEach(() => {
    published = null;
  });

  it('passes status to over and broadcasts game_over with finalScore', () => {
    const state = createInitialState();
    state.status = 'running';
    state.score = 1234;

    endGame(state, mockPublisher);

    assert.equal(state.status, 'over');
    assert.ok(state.endedAt !== null);
    assert.ok(published !== null);
    assert.equal(published!.type, 'game_over');
    assert.equal(
      (published as Extract<GameEvent, { type: 'game_over' }>).payload.finalScore,
      1234,
    );
  });

  it('does nothing if already over', () => {
    const state = createInitialState();
    state.status = 'over';

    endGame(state, mockPublisher);

    assert.equal(published, null);
  });

  it('does nothing if idle', () => {
    const state = createInitialState();
    endGame(state, mockPublisher);
    assert.equal(published, null);
  });
});
