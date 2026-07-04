import type { Vec3 } from '../../domain/ball.js';
import type { FlipperSide } from '../../domain/flipper.js';
import type { PaymentStatus } from '../../domain/payment.js';
import type { TournamentStatus } from '../../domain/tournament.js';

export interface BallPositionEvent {
  type: 'ball_position';
  payload: Vec3;
}

export interface ScoreUpdateEvent {
  type: 'score_update';
  payload: { score: number; ballsLeft: number; multiplier?: number };
}

export interface BallDrainedEvent {
  type: 'ball_drained';
  payload: { ballsLeft: number };
}

export interface BumperHitEvent {
  type: 'bumper_hit';
  payload: { id: string; x: number; z: number };
}

export interface SlingshotHitEvent {
  type: 'slingshot_hit';
  payload: { id: string; x: number; z: number };
}

export interface GameOverEvent {
  type: 'game_over';
  payload: { finalScore: number };
}

export interface FlipperStateEvent {
  type: 'flipper_state';
  payload: { side: FlipperSide; active: boolean };
}

export interface BallLaunchedEvent {
  type: 'ball_launched';
  payload: { force: number };
}

export interface BoostChangedEvent {
  type: 'boost_changed';
  payload: { active: boolean; multiplier: number; durationMs: number };
}

// --- Blockchain / tournament events (rendered by the screens, never computed there) ---

export interface WalletConnectedEvent {
  type: 'wallet_connected';
  payload: { walletShort: string }; // anonymised XXX...XXX
}

export interface PaymentProgressEvent {
  type: 'payment_progress';
  payload: {
    reference: string;
    receivedSol: number;
    targetSol: number;
    remainingSol: number;
    status: PaymentStatus;
  };
}

export interface TournamentSummary {
  id: string;
  status: TournamentStatus;
  participants: number;
  maxParticipants: number;
  entryFeeSol: number;
  prizeSol: number;
  winnerShort: string | null;
}

export interface TournamentUpdateEvent {
  type: 'tournament_update';
  payload: TournamentSummary;
}

export interface PayoutEvent {
  type: 'payout';
  payload: { walletShort: string; amountSol: number; signature: string };
}

export interface RefundEvent {
  type: 'refund';
  payload: { walletShort: string; amountSol: number; signature: string | null };
}

export type GameEvent =
  | BallPositionEvent
  | ScoreUpdateEvent
  | BallDrainedEvent
  | BumperHitEvent
  | SlingshotHitEvent
  | GameOverEvent
  | FlipperStateEvent
  | BallLaunchedEvent
  | BoostChangedEvent
  | WalletConnectedEvent
  | PaymentProgressEvent
  | TournamentUpdateEvent
  | PayoutEvent
  | RefundEvent;

export interface GamePublisher {
  broadcast(event: GameEvent): void;
}
