import type { Vec3 } from '../../domain/ball.js';

export type BallPositionEvent = { type: 'ball_position'; payload: Vec3 };
export type TickEvent = { type: 'tick'; timestamp: number };
export type GameEvent = BallPositionEvent | TickEvent;

export interface GamePublisher {
  broadcast(event: GameEvent): void;
}
