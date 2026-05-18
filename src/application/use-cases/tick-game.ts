import type { PhysicsWorld } from '../ports/physics-world.js';
import type { GamePublisher } from '../ports/game-publisher.js';
import type { GameState } from '../../domain/game.js';
import { PLAYFIELD } from '../../domain/playfield.js';

// TEMP test mode: drain when the ball is about to touch the bottom wall
const DRAIN_Z = PLAYFIELD.depth / 2 - 0.5;
const FLIPPER_HIT_POINTS = 50;

function randomBumperPoints(): number {
  return Math.floor(Math.random() * 81) + 20;
}

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
  const bumperHits = physics.consumeBumperHits();
  let scoreChanged = false;
  if (hits > 0) {
    state.score += hits * FLIPPER_HIT_POINTS * state.multiplier;
    scoreChanged = true;
  }
  for (const b of bumperHits) {
    state.score += randomBumperPoints() * state.multiplier;
    publisher.broadcast({ type: 'bumper_hit', payload: { id: b.id, x: b.x, z: b.z } });
    scoreChanged = true;
  }
  if (scoreChanged) publishScoreUpdate(state, publisher);
  if (!state.ballInLane) {
    const nearMouthX = pos.x > PLAYFIELD.launchLane.separatorX - 0.6;
    const nearMouthZ = pos.z < PLAYFIELD.launchLane.zMin + 0.5;
    if (nearMouthX && nearMouthZ) {
      physics.applyBallImpulse({ x: -3, y: 0, z: 0.5 });
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
