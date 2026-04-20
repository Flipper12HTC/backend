import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { registerGameGateway } from './ws/gateway.js';
import { registerGameRoutes } from './routes/game.js';
import { registerHealthRoute } from './routes/health.js';

export const app = Fastify({ logger: true });

await app.register(websocket);
await registerGameGateway(app);
await registerGameRoutes(app);
await registerHealthRoute(app);
