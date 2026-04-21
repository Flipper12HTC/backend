import type { Ball } from './ball.js';
import type { FlipperSide } from './flipper.js';

export type GameStatus = 'idle' | 'running' | 'over';

export interface GameState {
  status: GameStatus;
  ball: Ball;
  activeFlipper: FlipperSide | null;
  score: number;
  ballsLeft: number;
}
