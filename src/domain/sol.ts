// Pure SOL <-> lamports helpers. No external deps so the domain stays framework-free.
// 1 SOL = 1_000_000_000 lamports (the smallest Solana unit).

export const LAMPORTS_PER_SOL = 1_000_000_000;

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

// Human-readable amount for UI/logs, e.g. "0.7800".
export function formatSol(sol: number, decimals = 4): string {
  return sol.toFixed(decimals);
}
