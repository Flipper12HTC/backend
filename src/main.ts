import { RapierPhysicsWorld } from './infrastructure/physics/rapier-world.js';
import { MqttInputSource } from './infrastructure/mqtt/mqtt-input-source.js';
import { FastifyWsPublisher } from './infrastructure/ws/fastify-ws-publisher.js';
import { PostgresScoreRepo } from './infrastructure/storage/postgres-score-repo.js';
import { createPaymentGateway } from './infrastructure/blockchain/payment-gateway-factory.js';
import { InMemoryPaymentStore } from './infrastructure/storage/in-memory-payment-store.js';
import { InMemoryTournamentRepo } from './infrastructure/storage/in-memory-tournament-repo.js';
import { buildApp, startApp, stopApp } from './interfaces/http/app.js';
import { tickGame } from './application/use-cases/tick-game.js';
import { setFlipperState } from './application/use-cases/set-flipper-state.js';
import { cancelTournament } from './application/use-cases/cancel-tournament.js';
import { isInactive } from './domain/tournament.js';
import { shortenWallet } from './domain/wallet.js';
import { createInitialState } from './domain/game.js';

const physics = new RapierPhysicsWorld();
const publisher = new FastifyWsPublisher();
const mqttInput = new MqttInputSource();

// Blockchain wiring: gateway impl chosen by env (solana devnet | fake offline).
const paymentGateway = createPaymentGateway();
const paymentStore = new InMemoryPaymentStore();
const tournamentRepo = new InMemoryTournamentRepo();

const scoreRepo = new PostgresScoreRepo();
try {
  await scoreRepo.init();
} catch (err) {
  console.error('[score-repo] init failed, scores will not persist:', err);
}

await physics.init();

const state = createInitialState();

const app = await buildApp({
  onWsConnect: (socket) => publisher.addClient(socket),
  physics,
  publisher,
  state,
  scoreRepo,
  paymentGateway,
  paymentStore,
  tournamentRepo,
});

await startApp(app);

// Auto-cancel + refund a tournament that went idle (no play within the inactivity window).
const TOURNAMENT_WATCH_MS = 10_000;
setInterval(() => {
  const active = tournamentRepo.getActive();
  if (!active || !isInactive(active, Date.now())) return;
  cancelTournament(tournamentRepo, paymentGateway, active.id, Date.now())
    .then(({ tournament, refunds }) => {
      for (const r of refunds) {
        publisher.broadcast({
          type: 'refund',
          payload: { walletShort: shortenWallet(r.wallet), amountSol: r.amountSol, signature: r.signature },
        });
      }
      publisher.broadcast({
        type: 'tournament_update',
        payload: {
          id: tournament.id,
          status: tournament.status,
          participants: tournament.participants.length,
          maxParticipants: tournament.config.maxParticipants,
          entryFeeSol: tournament.config.entryFeeLamports / 1_000_000_000,
          prizeSol: tournament.config.prizeLamports / 1_000_000_000,
          winnerShort: null,
        },
      });
    })
    .catch((err) => app.log.error({ err }, 'tournament auto-cancel failed'));
}, TOURNAMENT_WATCH_MS);

mqttInput.onButtonPress((side) => setFlipperState(physics, publisher, side, true));
mqttInput.onButtonRelease((side) => setFlipperState(physics, publisher, side, false));
mqttInput.connect();

const DT = 1 / 60;
setInterval(() => {
  tickGame(state, physics, publisher, DT, scoreRepo);
}, DT * 1000);

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  stopApp(app)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
