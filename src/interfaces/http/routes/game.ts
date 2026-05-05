import type { FastifyInstance } from 'fastify';
import type { AppDeps } from '../app.js';

export async function registerGameRoutes(
  app: FastifyInstance,
  deps: AppDeps,
): Promise<void> {
  const { physics } = deps;

  app.get('/game/reset', async () => {
    physics.resetBall();
    return { ok: true };
  });
}
