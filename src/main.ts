import { RapierPhysicsWorld } from './infrastructure/physics/rapier-world.js';
import { MqttInputSource } from './infrastructure/mqtt/mqtt-input-source.js';
import { FastifyWsPublisher } from './infrastructure/ws/fastify-ws-publisher.js';
import { PostgresScoreRepo } from './infrastructure/storage/postgres-score-repo.js';
import { SolanaClient } from './infrastructure/blockchain/solana-client.js';
import { buildApp, startApp, stopApp } from './interfaces/http/app.js';
import { tickGame } from './application/use-cases/tick-game.js';
import { handleFlipperPress } from './application/use-cases/handle-flipper-press.js';

const physics = new RapierPhysicsWorld();
const publisher = new FastifyWsPublisher();
const mqttInput = new MqttInputSource();

// instantiated for future use
new PostgresScoreRepo();
new SolanaClient();

await physics.init();

const app = await buildApp({
  onWsConnect: (socket) => publisher.addClient(socket),
  physics,
});

await startApp(app);

mqttInput.onButtonPress((side) => handleFlipperPress(physics, side));
mqttInput.connect();

const DT = 1 / 60;
setInterval(() => {
  tickGame(physics, publisher, DT);
}, DT * 1000);

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  stopApp(app)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
