// Port hiding the payment rails (Solana devnet in production, a fake in tests).
export interface PaymentRequest {
  /** "solana:" URL to encode as a QR code. */
  url: string;
  /** Unique reference identifying the payment on-chain. */
  reference: string;
}

export interface PaymentGateway {
  createPaymentRequest(amountSol: number, label: string, message: string): PaymentRequest;
  /** Total SOL received so far for this reference. */
  getReceivedSol(reference: string): Promise<number>;
  /** Wallet that sent the payment, or null while nothing arrived. */
  getPayerWallet(reference: string): Promise<string | null>;
  /** Sends SOL from the escrow; resolves with the transaction signature. */
  transfer(toWallet: string, amountSol: number): Promise<string>;
}
