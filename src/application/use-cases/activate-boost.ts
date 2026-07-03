import type { GamePublisher } from '../ports/game-publisher.js';
import type { GameState } from '../../domain/game.js';
import { BOOST_DURATION_MS, BOOST_MULTIPLIER } from '../../domain/game.js';

/**
 * Manually (re)activate the x3 jellyfish boost for its full duration — a debug/demo
 * helper bound to the H key. It sets the same state the 10-bumper threshold does, so
 * tick-game expires it after BOOST_DURATION_MS just like an earned boost.
 *
 * Broadcasts both events the screens rely on:
 *  - `boost_changed` drives the back-screen overlay + deco SpongeBob boost,
 *  - `score_update` refreshes the x{multiplier} pill on the back-screen.
 */
export function activateBoost(state: GameState, publisher: GamePublisher): void {
  state.multiplier = BOOST_MULTIPLIER;
  state.boostUntil = Date.now() + BOOST_DURATION_MS;

  publisher.broadcast({
    type: 'boost_changed',
    payload: { active: true, multiplier: state.multiplier, durationMs: BOOST_DURATION_MS },
  });
  publisher.broadcast({
    type: 'score_update',
    payload: { score: state.score, ballsLeft: state.ballsLeft, multiplier: state.multiplier },
  });
}
