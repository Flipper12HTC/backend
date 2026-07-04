import type { PaymentStore } from '../../application/ports/payment-store.js';
import type { PaymentIntent } from '../../domain/payment.js';

export class InMemoryPaymentStore implements PaymentStore {
  private readonly store = new Map<string, PaymentIntent>();

  save(intent: PaymentIntent): void {
    this.store.set(intent.reference, intent);
  }

  get(reference: string): PaymentIntent | undefined {
    return this.store.get(reference);
  }
}
