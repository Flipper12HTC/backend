import type { PaymentGateway, PaymentRequest } from '../../application/ports/payment-gateway.js';
import { LAMPORTS_PER_SOL } from '../../domain/sol.js';

// In-memory gateway for offline dev/tests (no devnet, no real SOL).
// - autoConfirm=true  -> every poll returns the full target (instant payment, demos).
// - autoConfirm=false -> stays at 0 until you call credit() to simulate a (partial) transfer.
export class FakePaymentGateway implements PaymentGateway {
  private readonly received = new Map<string, number>();
  private readonly target = new Map<string, number>();
  private counter = 0;

  constructor(private readonly autoConfirm = false) {}

  createPaymentRequest(amountSol: number, label: string, message: string): PaymentRequest {
    const reference = `fake_ref_${++this.counter}`;
    this.target.set(reference, Math.round(amountSol * LAMPORTS_PER_SOL));
    const params = new URLSearchParams({ amount: String(amountSol), reference, label, message });
    return { url: `solana:FAKE_ESCROW?${params.toString()}`, reference };
  }

  getReceivedLamports(reference: string): Promise<number> {
    if (this.autoConfirm) return Promise.resolve(this.target.get(reference) ?? 0);
    return Promise.resolve(this.received.get(reference) ?? 0);
  }

  getPayerWallet(reference: string): Promise<string | null> {
    return Promise.resolve(`FakePayer_${reference}`);
  }

  transfer(toWallet: string, amountSol: number): Promise<string> {
    return Promise.resolve(`fake_tx_${toWallet.slice(0, 4)}_${amountSol}`);
  }

  // Test/dev helper: simulate an incoming (possibly partial) transfer.
  credit(reference: string, lamports: number): void {
    this.received.set(reference, (this.received.get(reference) ?? 0) + lamports);
  }
}
