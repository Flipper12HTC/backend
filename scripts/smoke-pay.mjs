// Smoke test for the real devnet wiring. Run: node --env-file=.env scripts/smoke-pay.mjs
import { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';

const secret = process.env.SOLANA_ESCROW_SECRET;
if (!secret) throw new Error('SOLANA_ESCROW_SECRET missing');
const escrow = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));

const rpc = process.env.SOLANA_RPC_URL ?? clusterApiUrl('devnet');
const connection = new Connection(rpc, 'confirmed');

// 1) Build a Solana Pay transfer-request URL (what the QR encodes).
const reference = Keypair.generate().publicKey;
const params = new URLSearchParams({
  amount: '0.8',
  reference: reference.toBase58(),
  label: 'Flipper 12 - launch',
  message: 'launch',
});
const url = `solana:${escrow.publicKey.toBase58()}?${params.toString()}`;

console.log('GATEWAY      = solana (devnet)');
console.log('RPC          =', rpc);
console.log('ESCROW       =', escrow.publicKey.toBase58());
console.log('SOLANA PAY URL=', url);

// 2) Confirm the RPC is reachable and report balances.
const bal = await connection.getBalance(escrow.publicKey);
console.log('ESCROW BALANCE=', bal / LAMPORTS_PER_SOL, 'SOL');

// 3) Fresh reference has no transfers yet -> 0 received.
const sigs = await connection.getSignaturesForAddress(reference, { limit: 10 }, 'confirmed');
console.log('RECEIVED FOR FRESH REF (expect 0 sigs) =', sigs.length);
