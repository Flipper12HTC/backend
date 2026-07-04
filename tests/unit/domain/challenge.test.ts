import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGE,
  isWon,
  shortenWallet,
  toChallengeView,
} from '../../../src/domain/challenge.js';

describe('challenge domain rules', () => {
  it('wins strictly above the target score', () => {
    assert.equal(isWon(CHALLENGE.targetScore + 1), true);
    assert.equal(isWon(CHALLENGE.targetScore), false);
    assert.equal(isWon(0), false);
  });

  it('shortens a wallet to first4...last4 for the leaderboard', () => {
    assert.equal(shortenWallet('Ai5q9DTEFnbXcRoUsUXgxFwAiVDe6mWKk8QuAyVhHc'), 'Ai5q...VhHc');
  });

  it('maps no challenge to a hidden QR', () => {
    const view = toChallengeView(null);
    assert.equal(view.status, 'none');
    assert.equal(view.qrUrl, null);
  });

  it('exposes the QR only while the offer is unpaid', () => {
    const base = { reference: 'r', qrUrl: 'solana:X', wallet: null };
    assert.equal(toChallengeView({ ...base, status: 'offered' }).qrUrl, 'solana:X');
    assert.equal(toChallengeView({ ...base, status: 'paid', wallet: 'W1234567890' }).qrUrl, null);
  });
});
