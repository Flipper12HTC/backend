import { lamportsToSol } from './sol.js';

// Lifecycle of an incoming SOL payment tracked by an on-chain reference key.
// 'partial' supports the "0.78 / 0.80 SOL" case: some SOL received, not enough yet.
export type PaymentStatus = 'pending' | 'partial' | 'confirmed' | 'cancelled' | 'refunded';

export interface PaymentIntent {
  reference: string; // base58 pubkey carried by every transfer, lets us find them on-chain
  targetLamports: number; // amount required to satisfy the payment
  receivedLamports: number; // amount detected on-chain so far
  status: PaymentStatus;
  label: string;
  createdAt: number;
}

export function createPaymentIntent(
  reference: string,
  targetLamports: number,
  label: string,
  now: number,
): PaymentIntent {
  return {
    reference,
    targetLamports,
    receivedLamports: 0,
    status: 'pending',
    label,
    createdAt: now,
  };
}

// Recompute status from the amount seen on-chain. Terminal states are never overwritten.
export function applyReceived(intent: PaymentIntent, receivedLamports: number): PaymentIntent {
  if (intent.status === 'cancelled' || intent.status === 'refunded') return intent;
  const status: PaymentStatus =
    receivedLamports >= intent.targetLamports
      ? 'confirmed'
      : receivedLamports > 0
        ? 'partial'
        : 'pending';
  return { ...intent, receivedLamports, status };
}

export function remainingLamports(intent: PaymentIntent): number {
  return Math.max(0, intent.targetLamports - intent.receivedLamports);
}

export function isSatisfied(intent: PaymentIntent): boolean {
  return intent.status === 'confirmed';
}

// View-model the screens render: "receivedSol / targetSol" + how much is left.
export interface PaymentProgress {
  reference: string;
  receivedSol: number;
  targetSol: number;
  remainingSol: number;
  status: PaymentStatus;
}

export function toProgress(intent: PaymentIntent): PaymentProgress {
  return {
    reference: intent.reference,
    receivedSol: lamportsToSol(intent.receivedLamports),
    targetSol: lamportsToSol(intent.targetLamports),
    remainingSol: lamportsToSol(remainingLamports(intent)),
    status: intent.status,
  };
}
