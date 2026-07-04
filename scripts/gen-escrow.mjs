// One-shot helper: generates a devnet escrow keypair and tries to airdrop SOL.
// Usage: node scripts/gen-escrow.mjs
import { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';

const kp = Keypair.generate();
const secret = JSON.stringify(Array.from(kp.secretKey));
const pubkey = kp.publicKey.toBase58();

console.log('PUBKEY=' + pubkey);
console.log('SECRET=' + secret);

try {
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const sig = await connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature: sig, ...latest }, 'confirmed');
  const bal = await connection.getBalance(kp.publicKey);
  console.log('AIRDROP_OK balance=' + bal / LAMPORTS_PER_SOL + ' SOL');
} catch (err) {
  console.log('AIRDROP_FAILED ' + (err instanceof Error ? err.message : String(err)));
}
