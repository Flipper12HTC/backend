import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import type { PhysicsWorld } from '../../application/ports/physics-world.js';
import type { GamePublisher } from '../../application/ports/game-publisher.js';
import type { ScoreRepo } from '../../application/ports/score-repo.js';
import type { PaymentGateway } from '../../application/ports/payment-gateway.js';
import type { PaymentStore } from '../../application/ports/payment-store.js';
import type { TournamentRepo } from '../../application/ports/tournament-repo.js';
import type { GameState } from '../../domain/game.js';
import { registerHealthRoute } from './routes/health.js';
import { registerGameRoutes } from './routes/game.js';
import { registerScoreRoutes } from './routes/scores.js';
import { registerPaymentRoutes } from './routes/payment.js';
import { registerTournamentRoutes } from './routes/tournament.js';
import { registerGateway } from './ws/gateway.js';

export interface AppDeps {
  onWsConnect: (socket: WebSocket) => void;
  physics: PhysicsWorld;
  publisher: GamePublisher;
  state: GameState;
  scoreRepo?: ScoreRepo;
  paymentGateway?: PaymentGateway;
  paymentStore?: PaymentStore;
  tournamentRepo?: TournamentRepo;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  });
  await app.register(websocket);
  registerGateway(app, deps.onWsConnect);
  await registerHealthRoute(app);
  await registerGameRoutes(app, deps);
  if (deps.scoreRepo) await registerScoreRoutes(app, deps.scoreRepo);
  if (deps.paymentGateway && deps.paymentStore) {
    await registerPaymentRoutes(app, {
      gateway: deps.paymentGateway,
      store: deps.paymentStore,
      publisher: deps.publisher,
    });
  }
  if (deps.paymentGateway && deps.paymentStore && deps.tournamentRepo) {
    await registerTournamentRoutes(app, {
      repo: deps.tournamentRepo,
      gateway: deps.paymentGateway,
      paymentStore: deps.paymentStore,
      publisher: deps.publisher,
    });
  }
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
