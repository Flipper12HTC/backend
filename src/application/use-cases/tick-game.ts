import type { PhysicsWorld } from '../ports/physics-world.js';
import type { GamePublisher } from '../ports/game-publisher.js';
import type { GameState } from '../../domain/game.js';
import { PLAYFIELD } from '../../domain/playfield.js';

// TEMP test mode: drain when the ball is about to touch the bottom wall
const DRAIN_Z = PLAYFIELD.depth / 2 - 0.5;
const FLIPPER_HIT_POINTS = 50;
// Speed and position window in which the ball is considered "back at the plunger" —
// used to re-arm the plunger when a weak launch sends the ball back to the spawn.
const REARM_SPEED_THRESHOLD = 0.3;
const REARM_Z_TOLERANCE = 0.3;

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

  // Re-arm the plunger only when the ball is back at the spawn position
  // (resting against the bottom of the launch lane), not just slow mid-flight.
  if (!state.ballInLane) {
    const inLane = pos.x > PLAYFIELD.launchLane.separatorX;
    const atSpawn = pos.z > PLAYFIELD.ball.spawn.z - REARM_Z_TOLERANCE;
    if (inLane && atSpawn && physics.getBallSpeed() < REARM_SPEED_THRESHOLD) {
      state.ballInLane = true;
    }
  }

  // Drain only outside the launch lane: a ball still in the lane (resting against
  // the bottom wall before the player pulls the plunger) must not be counted as drained.
  const outsideLane = pos.x < PLAYFIELD.launchLane.separatorX;
  const drained = pos.y < PLAYFIELD.drain.yThreshold || (pos.z > DRAIN_Z && outsideLane);
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
  state.ballInLane = true;
  publisher.broadcast({
    type: 'ball_position',
    payload: physics.getBallPosition(),
  });
}
