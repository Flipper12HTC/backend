import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { endGame } from '../../../src/application/use-cases/end-game.js';
import type { GamePublisher, GameEvent } from '../../../src/application/ports/game-publisher.js';

let published: GameEvent | null = null;

const mockPublisher: GamePublisher = {
  broadcast: (event) => { published = event; },
};

describe('endGame', () => {
  beforeEach(() => { published = null; });

  it('broadcasts a tick event', () => {
    endGame(mockPublisher);
    assert.ok(published !== null);
    assert.equal(published!.type, 'tick');
  });
});
