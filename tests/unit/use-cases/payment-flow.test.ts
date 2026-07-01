import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FakePaymentGateway } from '../../../src/infrastructure/blockchain/fake-payment-gateway.js';
import { InMemoryPaymentStore } from '../../../src/infrastructure/storage/in-memory-payment-store.js';
import { startPayment } from '../../../src/application/use-cases/start-payment.js';
import { refreshPayment } from '../../../src/application/use-cases/refresh-payment.js';
import { refundPayment } from '../../../src/application/use-cases/refund-payment.js';
import { solToLamports } from '../../../src/domain/sol.js';

describe('payment flow use-cases', () => {
  it('refreshes from pending -> partial -> confirmed as SOL arrives', async () => {
    const gateway = new FakePaymentGateway();
    const store = new InMemoryPaymentStore();
    const { intent } = startPayment(gateway, store, 0.8, 'launch', 'game', 0);
    assert.equal(intent.status, 'pending');

    gateway.credit(intent.reference, solToLamports(0.78));
    const partial = await refreshPayment(gateway, store, intent.reference);
    assert.equal(partial?.status, 'partial');

    gateway.credit(intent.reference, solToLamports(0.02));
    const confirmed = await refreshPayment(gateway, store, intent.reference);
    assert.equal(confirmed?.status, 'confirmed');
  });

  it('refunds a received payment and marks it refunded', async () => {
    const gateway = new FakePaymentGateway();
    const store = new InMemoryPaymentStore();
    const { intent } = startPayment(gateway, store, 0.11, 'entry', 'fee', 0);
    gateway.credit(intent.reference, solToLamports(0.11));
    await refreshPayment(gateway, store, intent.reference);

    const { intent: refunded, signature } = await refundPayment(
      gateway,
      store,
      intent.reference,
      'walletA',
    );
    assert.equal(refunded.status, 'refunded');
    assert.ok(signature);
  });

  it('cancels (no transfer) when nothing was received', async () => {
    const gateway = new FakePaymentGateway();
    const store = new InMemoryPaymentStore();
    const { intent } = startPayment(gateway, store, 0.11, 'entry', 'fee', 0);
    const { intent: cancelled, signature } = await refundPayment(
      gateway,
      store,
      intent.reference,
      'walletA',
    );
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(signature, null);
  });
});
