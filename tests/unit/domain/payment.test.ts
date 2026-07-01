import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPaymentIntent,
  applyReceived,
  remainingLamports,
  isSatisfied,
  toProgress,
} from '../../../src/domain/payment.js';
import { solToLamports } from '../../../src/domain/sol.js';

const target = solToLamports(0.8);

describe('payment domain', () => {
  it('starts pending with nothing received', () => {
    const intent = createPaymentIntent('ref1', target, 'launch', 0);
    assert.equal(intent.status, 'pending');
    assert.equal(intent.receivedLamports, 0);
    assert.equal(remainingLamports(intent), target);
  });

  it('goes partial then confirmed (the 0.78/0.80 case)', () => {
    let intent = createPaymentIntent('ref1', target, 'launch', 0);
    intent = applyReceived(intent, solToLamports(0.78));
    assert.equal(intent.status, 'partial');
    assert.equal(remainingLamports(intent), solToLamports(0.02));
    assert.equal(isSatisfied(intent), false);

    intent = applyReceived(intent, solToLamports(0.8));
    assert.equal(intent.status, 'confirmed');
    assert.equal(remainingLamports(intent), 0);
    assert.equal(isSatisfied(intent), true);
  });

  it('never overwrites a terminal status', () => {
    let intent = createPaymentIntent('ref1', target, 'launch', 0);
    intent = { ...intent, status: 'refunded' };
    const after = applyReceived(intent, target);
    assert.equal(after.status, 'refunded');
  });

  it('exposes a SOL progress view-model', () => {
    let intent = createPaymentIntent('ref1', target, 'launch', 0);
    intent = applyReceived(intent, solToLamports(0.78));
    const p = toProgress(intent);
    assert.equal(p.receivedSol, 0.78);
    assert.equal(p.targetSol, 0.8);
    assert.equal(Number(p.remainingSol.toFixed(2)), 0.02);
    assert.equal(p.status, 'partial');
  });
});
