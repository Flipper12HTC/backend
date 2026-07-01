import type { PaymentIntent } from '../../domain/payment.js';

// Keeps payment intents alive between the initial request and the polling refreshes.
export interface PaymentStore {
  save(intent: PaymentIntent): void;
  get(reference: string): PaymentIntent | undefined;
}
