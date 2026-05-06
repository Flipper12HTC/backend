import type { PhysicsWorld } from '../ports/physics-world.js';
import type { GamePublisher } from '../ports/game-publisher.js';
import type { GameState } from '../../domain/game.js';
import { PLAYFIELD } from '../../domain/playfield.js';

// TEMP test mode: drain when the ball is about to touch the bottom wall
const DRAIN_Z = PLAYFIELD.depth / 2 - 0.5;
const FLIPPER_HIT_POINTS = 50;

function publishScoreUpdate(state: GameState, publisher: GamePublisher): void {
  publisher.broadcast({
    type: 'score_update',
    payload: {
      score: state.score,
      ballsLeft: state.ballsLeft,
      multiplier: state.multiplier,
    },
  });
}

export function tickGame(
  state: GameState,
  physics: PhysicsWorld,
  publisher: GamePublisher,
  dt: number,
): void {
  if (state.status !== 'running') return;

  physics.step(dt);
  const pos = physics.getBallPosition();
  publisher.broadcast({ type: 'ball_position', payload: pos });

  const hits = physics.consumeFlipperHits();
  if (hits > 0) {
    state.score += hits * FLIPPER_HIT_POINTS * state.multiplier;
    publishScoreUpdate(state, publisher);
  }

  const drained = pos.y < PLAYFIELD.drain.yThreshold || pos.z > DRAIN_Z;
  if (!drained) return;

  state.ballsLeft -= 1;
  publisher.broadcast({
    type: 'ball_drained',
    payload: { ballsLeft: state.ballsLeft },
  });

  if (state.ballsLeft <= 0) {
    state.status = 'over';
    state.endedAt = Date.now();
    publisher.broadcast({
      type: 'game_over',
      payload: { finalScore: state.score },
    });
    return;
  }

  physics.resetBall();
  publisher.broadcast({
    type: 'ball_position',
    payload: physics.getBallPosition(),
  });
}
