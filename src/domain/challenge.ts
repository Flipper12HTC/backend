// Paid challenge: scan the QR on the backglass, pay the entry fee, and beat
// the target score to win the reward. Skipping the payment simply starts a
// normal (free) game.
export const CHALLENGE = {
  entryFeeSol: 0.2,
  rewardSol: 1,
  targetScore: 1500, // strictly more than this wins
} as const;

export type ChallengeStatus = 'offered' | 'paid' | 'won' | 'lost';

export interface Challenge {
  /** Unique payment reference (pubkey) used to find the transfer on-chain. */
  reference: string;
  /** "solana:" transfer-request URL rendered as a QR code on the backglass. */
  qrUrl: string;
  status: ChallengeStatus;
  /** Payer wallet, known once the entry fee is detected on-chain. */
  wallet: string | null;
}

/** Single mutable slot owned by the composition root (one cabinet = one challenge). */
export interface ChallengeBox {
  current: Challenge | null;
}

export function createChallengeBox(): ChallengeBox {
  return { current: null };
}

export function isWon(finalScore: number): boolean {
  return finalScore > CHALLENGE.targetScore;
}

/** "Ai5q9DTEFnbXcRoUsUXgxFwAiVDe6mWKk8QuAyXeVhHc" -> "Ai5q...VhHc" (leaderboard display). */
export function shortenWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

/** Payload of the `challenge_updated` event; `status: 'none'` hides the QR. */
export interface ChallengeView {
  status: ChallengeStatus | 'none';
  qrUrl: string | null;
  walletShort: string | null;
  entryFeeSol: number;
  rewardSol: number;
  targetScore: number;
}

export function toChallengeView(challenge: Challenge | null): ChallengeView {
  return {
    status: challenge?.status ?? 'none',
    qrUrl: challenge?.status === 'offered' ? challenge.qrUrl : null,
    walletShort: challenge?.wallet ? shortenWallet(challenge.wallet) : null,
    entryFeeSol: CHALLENGE.entryFeeSol,
    rewardSol: CHALLENGE.rewardSol,
    targetScore: CHALLENGE.targetScore,
  };
}
