import type { PaymentGateway } from '../ports/payment-gateway.js';
import type { PaymentStore } from '../ports/payment-store.js';
import type { PaymentIntent } from '../../domain/payment.js';
import { applyReceived } from '../../domain/payment.js';

// Re-reads the chain, updates the stored intent, returns the fresh state.
// The QR screen polls this; status flips pending -> partial -> confirmed.
export async function refreshPayment(
  gateway: PaymentGateway,
  store: PaymentStore,
  reference: string,
): Promise<PaymentIntent | undefined> {
  const intent = store.get(reference);
  if (!intent) return undefined;
  const received = await gateway.getReceivedLamports(reference);
  const updated = applyReceived(intent, received);
  store.save(updated);
  return updated;
}
