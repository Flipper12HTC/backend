// One-shot helper: generates the devnet escrow keypair and tries to airdrop SOL.
// Copy SECRET into .env as SOLANA_ESCROW_SECRET, then fund PUBKEY via
// https://faucet.solana.com if the airdrop fails (devnet faucet is often dry).
// Usage: node scripts/gen-escrow.mjs
import { Connection, Keypair, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';

const kp = Keypair.generate();
console.log(`PUBKEY=${kp.publicKey.toBase58()}`);
console.log(`SECRET=[${kp.secretKey.toString()}]`);

try {
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const sig = await connection.requestAirdrop(kp.publicKey, 2 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, 'confirmed');
  console.log('AIRDROP_OK 2 SOL');
} catch (err) {
  console.log(`AIRDROP_FAILED ${err instanceof Error ? err.message : err}`);
}
