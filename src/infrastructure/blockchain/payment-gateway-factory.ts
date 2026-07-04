import { Keypair } from '@solana/web3.js';
import type { PaymentGateway } from '../../application/ports/payment-gateway.js';
import { SolanaPayGateway } from './solana-pay-gateway.js';
import { FakePaymentGateway } from './fake-payment-gateway.js';

function escrowFromEnv(): Keypair {
  const secret = process.env['SOLANA_ESCROW_SECRET'];
  if (!secret) throw new Error('SOLANA_ESCROW_SECRET is required for the solana gateway');
  const bytes = Uint8Array.from(JSON.parse(secret) as number[]);
  return Keypair.fromSecretKey(bytes);
}

// Composition helper: pick the gateway impl from env. Same idea as the frontend's
// VITE_GAME_SOURCE switch — swap infra without touching the application layer.
export function createPaymentGateway(): PaymentGateway {
  if (process.env['PAYMENT_GATEWAY'] === 'solana') {
    return new SolanaPayGateway({
      rpcUrl: process.env['SOLANA_RPC_URL'] ?? 'https://api.devnet.solana.com',
      escrow: escrowFromEnv(),
    });
  }
  return new FakePaymentGateway(process.env['PAYMENT_AUTOCONFIRM'] === 'true');
}
