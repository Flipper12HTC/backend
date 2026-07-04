import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import type { PaymentGateway, PaymentRequest } from '../../application/ports/payment-gateway.js';
import { LAMPORTS_PER_SOL } from '../../domain/sol.js';

export interface SolanaPayConfig {
  rpcUrl: string;
  escrow: Keypair;
}

// Real Solana Pay gateway on devnet.
// - Incoming: builds a "solana:" transfer-request URL; tracks payments by a unique
//   reference pubkey. Phantom/Solflare scan the QR, the user approves, SOL lands on escrow.
// - Outgoing: refunds/payouts are plain SystemProgram transfers signed by escrow.
export class SolanaPayGateway implements PaymentGateway {
  private readonly connection: Connection;
  private readonly escrow: Keypair;

  constructor(config: SolanaPayConfig) {
    this.connection = new Connection(config.rpcUrl, 'confirmed');
    this.escrow = config.escrow;
  }

  createPaymentRequest(amountSol: number, label: string, message: string): PaymentRequest {
    // A fresh reference key per payment lets us find the transfer(s) without knowing the payer.
    const reference = Keypair.generate().publicKey;
    const params = new URLSearchParams({
      amount: String(amountSol),
      reference: reference.toBase58(),
      label,
      message,
    });
    const url = `solana:${this.escrow.publicKey.toBase58()}?${params.toString()}`;
    return { url, reference: reference.toBase58() };
  }

  async getReceivedLamports(reference: string): Promise<number> {
    const ref = new PublicKey(reference);
    const sigs = await this.connection.getSignaturesForAddress(ref, { limit: 50 }, 'confirmed');

    let total = 0;
    for (const { signature } of sigs) {
      const tx = await this.connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx || tx.meta?.err) continue;

      const keys = tx.transaction.message.accountKeys;
      const idx = keys.findIndex((k) => k.pubkey.equals(this.escrow.publicKey));
      if (idx < 0) continue;

      const pre = tx.meta?.preBalances[idx] ?? 0;
      const post = tx.meta?.postBalances[idx] ?? 0;
      const delta = post - pre;
      if (delta > 0) total += delta; // credit to escrow = a payment toward this reference
    }
    return total;
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
      const keys = tx.transaction.message.accountKeys;
      // The payer is the signer whose balance went down (sent SOL to escrow).
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
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: this.escrow.publicKey,
        toPubkey: new PublicKey(toWallet),
        lamports,
      }),
    );
    return sendAndConfirmTransaction(this.connection, tx, [this.escrow]);
  }
}
