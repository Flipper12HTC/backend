// Port for receiving SOL via Solana Pay and sending SOL back (refund / payout).
// Pure interface: no Solana SDK import here so the application layer stays infra-free.

export interface PaymentRequest {
  url: string; // "solana:" URL to encode in the QR code
  reference: string; // base58 pubkey used to track the incoming transfer(s)
}

export interface PaymentGateway {
  // Build a Solana Pay request for `amountSol` to the escrow wallet.
  createPaymentRequest(amountSol: number, label: string, message: string): PaymentRequest;

  // Sum of confirmed lamports transferred to escrow that carry `reference`.
  // Supports partial payments: returns the running total across several transfers.
  getReceivedLamports(reference: string): Promise<number>;

  // The wallet that paid (signer of a transfer carrying `reference`), or null if none yet.
  // Used to know who joined a tournament so the prize/refund can be sent back.
  getPayerWallet(reference: string): Promise<string | null>;

  // Send `amountSol` from escrow to a wallet (used for refunds and payouts).
  // Returns the transaction signature.
  transfer(toWallet: string, amountSol: number): Promise<string>;
}
