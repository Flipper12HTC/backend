import type { PaymentGateway, PaymentRequest } from '../../application/ports/payment-gateway.js';

// Offline stand-in for Solana: used by unit tests and local dev without a wallet.
// With autoConfirm the entry fee is "received" on the first poll.
export class FakePaymentGateway implements PaymentGateway {
  private counter = 0;
  private readonly received = new Map<string, number>();
  /** Transfers performed, recorded so tests can assert on payouts. */
  readonly transfers: { toWallet: string; amountSol: number }[] = [];

  constructor(private readonly autoConfirm: boolean) {}

  createPaymentRequest(amountSol: number, label: string, message: string): PaymentRequest {
    const reference = `fake-ref-${++this.counter}`;
    if (this.autoConfirm) this.received.set(reference, amountSol);
    const params = new URLSearchParams({ amount: String(amountSol), reference, label, message });
    return { url: `solana:FAKE?${params.toString()}`, reference };
  }

  getReceivedSol(reference: string): Promise<number> {
    return Promise.resolve(this.received.get(reference) ?? 0);
  }

  getPayerWallet(reference: string): Promise<string | null> {
    const paid = (this.received.get(reference) ?? 0) > 0;
    return Promise.resolve(paid ? 'FAKEwalletAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1234' : null);
  }

  transfer(toWallet: string, amountSol: number): Promise<string> {
    this.transfers.push({ toWallet, amountSol });
    return Promise.resolve(`fake-signature-${this.transfers.length}`);
  }

  /** Test helper: simulate an incoming payment for a reference. */
  credit(reference: string, amountSol: number): void {
    this.received.set(reference, (this.received.get(reference) ?? 0) + amountSol);
  }
}
