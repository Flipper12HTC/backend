import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import type { PaymentGateway, PaymentRequest } from '../../application/ports/payment-gateway.js';

const LAMPORTS_PER_SOL = 1_000_000_000;

export interface SolanaPayConfig {
  rpcUrl: string;
  /** Escrow keypair: receives entry fees and pays out rewards. */
  escrow: Keypair;
}

// Solana Pay gateway (devnet).
// - Incoming: builds a "solana:" transfer-request URL; a unique reference pubkey
//   per payment lets us find the transfer without knowing the payer upfront.
// - Outgoing: rewards are plain SystemProgram transfers signed by the escrow.
export class SolanaPayGateway implements PaymentGateway {
  private readonly connection: Connection;
  private readonly escrow: Keypair;

  constructor(config: SolanaPayConfig) {
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.escrow = config.escrow;
  }

  createPaymentRequest(amountSol: number, label: string, message: string): PaymentRequest {
    const reference = Keypair.generate().publicKey;
    const params = new URLSearchParams({
      amount: String(amountSol),
      reference: reference.toBase58(),
      label,
      message,
    });
    return {
      url: `solana:${this.escrow.publicKey.toBase58()}?${params.toString()}`,
      reference: reference.toBase58(),
    };
  }

  async getReceivedSol(reference: string): Promise<number> {
    const ref = new PublicKey(reference);
    const sigs = await this.connection.getSignaturesForAddress(ref, { limit: 50 }, 'confirmed');

    let lamports = 0;
    for (const { signature } of sigs) {
      const tx = await this.connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx || tx.meta?.err) continue;

      const keys = tx.transaction.message.accountKeys;
      const idx = keys.findIndex((k) => k.pubkey.equals(this.escrow.publicKey));
      if (idx < 0) continue;

      const delta = (tx.meta?.postBalances[idx] ?? 0) - (tx.meta?.preBalances[idx] ?? 0);
      if (delta > 0) lamports += delta; // credit to the escrow = a payment for this reference
    }
    return lamports / LAMPORTS_PER_SOL;
  }

  async getPayerWallet(reference: string): Promise<string | null> {
    const ref = new PublicKey(reference);
    const sigs = await this.connection.getSignaturesForAddress(ref, { limit: 50 }, 'confirmed');
    for (const { signature } of sigs) {
      const tx = await this.connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx || tx.meta?.err) continue;
      // The payer is the signer whose balance went down (sent SOL to the escrow).
      const keys = tx.transaction.message.accountKeys;
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!key?.signer) continue;
        const delta = (tx.meta?.postBalances[i] ?? 0) - (tx.meta?.preBalances[i] ?? 0);
        if (delta < 0) return key.pubkey.toBase58();
      }
    }
    return null;
  }

  async transfer(toWallet: string, amountSol: number): Promise<string> {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.escrow.publicKey,
        toPubkey: new PublicKey(toWallet),
        lamports: Math.round(amountSol * LAMPORTS_PER_SOL),
      }),
    );
    return sendAndConfirmTransaction(this.connection, tx, [this.escrow]);
  }
}
