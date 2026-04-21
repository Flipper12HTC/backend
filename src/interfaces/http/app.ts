import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { PhysicsWorld } from '../../application/ports/physics-world.js';
import { registerHealthRoute } from './routes/health.js';
import { registerGameRoutes } from './routes/game.js';
import { registerGateway } from './ws/gateway.js';

export interface AppDeps {
  onWsConnect: (socket: WebSocket) => void;
  physics: PhysicsWorld;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(websocket);
  registerGateway(app, deps.onWsConnect);
  await registerHealthRoute(app);
  await registerGameRoutes(app, deps.physics);
  return app;
}

export async function startApp(app: FastifyInstance): Promise<void> {
  const host = process.env['HOST'] ?? '0.0.0.0';
  const port = Number(process.env['PORT'] ?? 8080);
  await app.listen({ port, host });
}

export async function stopApp(app: FastifyInstance): Promise<void> {
  await app.close();
}
