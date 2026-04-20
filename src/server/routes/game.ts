import type { FastifyInstance } from 'fastify';
import { resetBall } from '../../game/physics.js';

export async function registerGameRoutes(app: FastifyInstance): Promise<void> {
  app.get('/game/reset', async () => {
    resetBall();
    return { ok: true };
  });
}
