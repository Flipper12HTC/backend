import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createTournament,
  addParticipant,
  isFull,
  pickWinner,
  recordScore,
  isInactive,
  MONO_TOURNAMENT_CONFIG,
} from '../../../src/domain/tournament.js';
import { solToLamports } from '../../../src/domain/sol.js';

describe('tournament domain', () => {
  it('matches the mono spec: 1 SOL prize, 10 seats, 0.11 SOL fee, 1 min idle', () => {
    assert.equal(MONO_TOURNAMENT_CONFIG.prizeLamports, solToLamports(1));
    assert.equal(MONO_TOURNAMENT_CONFIG.maxParticipants, 10);
    assert.equal(MONO_TOURNAMENT_CONFIG.entryFeeLamports, solToLamports(0.11));
    assert.equal(MONO_TOURNAMENT_CONFIG.inactivityTimeoutMs, 60_000);
  });

  it('adds participants and rejects dupes / overflow', () => {
    let t = createTournament('t1', { ...MONO_TOURNAMENT_CONFIG, maxParticipants: 2 }, 0);
    t = addParticipant(t, 'walletA', 'refA', 1);
    t = addParticipant(t, 'walletB', 'refB', 2);
    assert.equal(isFull(t), true);
    assert.throws(() => addParticipant(t, 'walletC', 'refC', 3), /full/);
    assert.throws(() => addParticipant(t, 'walletA', 'refA2', 4), /not open|full|already/);
  });

  it('picks the highest scorer as winner', () => {
    let t = createTournament('t1', MONO_TOURNAMENT_CONFIG, 0);
    t = addParticipant(t, 'walletA', 'refA', 1);
    t = addParticipant(t, 'walletB', 'refB', 2);
    t = recordScore(t, 'walletA', 1000, 3);
    t = recordScore(t, 'walletB', 4200, 4);
    assert.equal(pickWinner(t), 'walletB');
  });

  it('has no winner when nobody played', () => {
    let t = createTournament('t1', MONO_TOURNAMENT_CONFIG, 0);
    t = addParticipant(t, 'walletA', 'refA', 1);
    assert.equal(pickWinner(t), null);
  });

  it('flags inactivity after the timeout window', () => {
    let t = createTournament('t1', MONO_TOURNAMENT_CONFIG, 0);
    t = addParticipant(t, 'walletA', 'refA', 1_000);
    assert.equal(isInactive(t, 1_000 + 59_000), false);
    assert.equal(isInactive(t, 1_000 + 61_000), true);
  });
});
