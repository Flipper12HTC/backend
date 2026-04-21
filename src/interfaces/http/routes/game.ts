import type { FastifyInstance } from 'fastify';
import type { PhysicsWorld } from '../../../application/ports/physics-world.js';

export async function registerGameRoutes(
  app: FastifyInstance,
  physics: PhysicsWorld,
): Promise<void> {
  app.get('/game/reset', async () => {
    physics.resetBall();
    return { ok: true };
  });
}
