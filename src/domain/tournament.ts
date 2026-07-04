import type { WalletAddress } from './wallet.js';
import { solToLamports } from './sol.js';

export type TournamentStatus = 'open' | 'running' | 'completed' | 'cancelled';

export interface TournamentConfig {
  entryFeeLamports: number;
  prizeLamports: number;
  maxParticipants: number;
  inactivityTimeoutMs: number; // auto-cancel window after the last activity
}

export interface Participant {
  wallet: WalletAddress;
  paymentReference: string; // links back to the entry-fee PaymentIntent
  score: number | null; // null until the player finishes a game
  joinedAt: number;
}

export interface Tournament {
  id: string;
  config: TournamentConfig;
  status: TournamentStatus;
  participants: Participant[];
  createdAt: number;
  lastActivityAt: number;
  endedAt: number | null;
  winner: WalletAddress | null;
}

// Product spec: one "mono" tournament, prize 1 SOL, 10 seats, 0.11 SOL entry fee,
// auto-cancelled (and fully refunded) if nobody plays within 1 min of the last activity.
export const MONO_TOURNAMENT_CONFIG: TournamentConfig = {
  entryFeeLamports: solToLamports(0.11),
  prizeLamports: solToLamports(1),
  maxParticipants: 10,
  inactivityTimeoutMs: 60_000,
};

export function createTournament(id: string, config: TournamentConfig, now: number): Tournament {
  return {
    id,
    config,
    status: 'open',
    participants: [],
    createdAt: now,
    lastActivityAt: now,
    endedAt: null,
    winner: null,
  };
}

export function isFull(t: Tournament): boolean {
  return t.participants.length >= t.config.maxParticipants;
}

export function hasJoined(t: Tournament, wallet: WalletAddress): boolean {
  return t.participants.some((p) => p.wallet === wallet);
}

export function addParticipant(
  t: Tournament,
  wallet: WalletAddress,
  paymentReference: string,
  now: number,
): Tournament {
  if (t.status !== 'open') throw new Error('tournament is not open');
  if (isFull(t)) throw new Error('tournament is full');
  if (hasJoined(t, wallet)) throw new Error('wallet already joined');
  if (t.participants.some((p) => p.paymentReference === paymentReference))
    throw new Error('payment reference already used');
  const participant: Participant = { wallet, paymentReference, score: null, joinedAt: now };
  return { ...t, participants: [...t.participants, participant], lastActivityAt: now };
}

export function removeParticipant(t: Tournament, wallet: WalletAddress, now: number): Tournament {
  return {
    ...t,
    participants: t.participants.filter((p) => p.wallet !== wallet),
    lastActivityAt: now,
  };
}

export function recordScore(
  t: Tournament,
  wallet: WalletAddress,
  score: number,
  now: number,
): Tournament {
  return {
    ...t,
    participants: t.participants.map((p) => (p.wallet === wallet ? { ...p, score } : p)),
    lastActivityAt: now,
  };
}

// True once the inactivity window has elapsed -> tournament should be cancelled + refunded.
export function isInactive(t: Tournament, now: number): boolean {
  return now - t.lastActivityAt >= t.config.inactivityTimeoutMs;
}

// Winner = highest score among participants who actually played. null if nobody played.
export function pickWinner(t: Tournament): WalletAddress | null {
  const played = t.participants.filter(
    (p): p is Participant & { score: number } => p.score !== null,
  );
  if (played.length === 0) return null;
  const best = played.reduce((acc, p) => (p.score > acc.score ? p : acc));
  return best.wallet;
}
