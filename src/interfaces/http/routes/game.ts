import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.js';
import { startGame } from '../../../application/use-cases/start-game.js';
import { endGame } from '../../../application/use-cases/end-game.js';

export async function registerGameRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const { state, physics, publisher } = deps;

  app.post('/game/start', async (_req, reply) => {
    if (state.status === 'running') {
      await reply.code(409).send({ error: 'game already running' });
      return;
    }
    startGame(state, physics, publisher);
    return { ok: true, status: state.status };
  });

  app.post('/game/end', async (_req, reply) => {
    if (state.status !== 'running') {
      await reply.code(409).send({ error: 'no game running' });
      return;
    }
    endGame(state, publisher);
    return { ok: true, status: state.status };
  });

  app.get('/game/state', async () => ({
    status: state.status,
    score: state.score,
    ballsLeft: state.ballsLeft,
    multiplier: state.multiplier,
    activeFlipper: state.activeFlipper,
    player: state.player,
    startedAt: state.startedAt,
    endedAt: state.endedAt,
  }));

  app.get('/game/reset', async () => {
    physics.resetBall();
    return { ok: true };
  });
}
