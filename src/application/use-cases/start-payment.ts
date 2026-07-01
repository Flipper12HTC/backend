import type { PaymentGateway } from '../ports/payment-gateway.js';
import type { PaymentStore } from '../ports/payment-store.js';
import type { PaymentIntent } from '../../domain/payment.js';
import { createPaymentIntent } from '../../domain/payment.js';
import { solToLamports } from '../../domain/sol.js';

// Creates a Solana Pay request and the intent that tracks it.
export function startPayment(
  gateway: PaymentGateway,
  store: PaymentStore,
  amountSol: number,
  label: string,
  message: string,
  now: number,
): { intent: PaymentIntent; url: string } {
  const req = gateway.createPaymentRequest(amountSol, label, message);
  const intent = createPaymentIntent(req.reference, solToLamports(amountSol), label, now);
  store.save(intent);
  return { intent, url: req.url };
}
