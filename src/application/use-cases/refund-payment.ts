import type { PaymentGateway } from '../ports/payment-gateway.js';
import type { PaymentStore } from '../ports/payment-store.js';
import type { PaymentIntent } from '../../domain/payment.js';
import { lamportsToSol } from '../../domain/sol.js';

// Refunds whatever was received for an intent (entry cancellation).
// If nothing was received yet, the intent is simply marked cancelled (no transfer).
export async function refundPayment(
  gateway: PaymentGateway,
  store: PaymentStore,
  reference: string,
  toWallet: string,
): Promise<{ intent: PaymentIntent; signature: string | null }> {
  const intent = store.get(reference);
  if (!intent) throw new Error('payment intent not found');

  // Terminal states are final: never transfer twice for the same intent.
  if (intent.status === 'refunded' || intent.status === 'cancelled') {
    return { intent, signature: null };
  }

  if (intent.receivedLamports <= 0) {
    const cancelled: PaymentIntent = { ...intent, status: 'cancelled' };
    store.save(cancelled);
    return { intent: cancelled, signature: null };
  }

  const signature = await gateway.transfer(toWallet, lamportsToSol(intent.receivedLamports));
  const refunded: PaymentIntent = { ...intent, status: 'refunded' };
  store.save(refunded);
  return { intent: refunded, signature };
}
