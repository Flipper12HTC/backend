import { RapierPhysicsWorld } from './infrastructure/physics/rapier-world.js';
import { MqttInputSource } from './infrastructure/mqtt/mqtt-input-source.js';
import { FastifyWsPublisher } from './infrastructure/ws/fastify-ws-publisher.js';
import { PostgresScoreRepo } from './infrastructure/storage/postgres-score-repo.js';
import { buildApp, startApp, stopApp } from './interfaces/http/app.js';
import { tickGame } from './application/use-cases/tick-game.js';
import { setFlipperState } from './application/use-cases/set-flipper-state.js';
import { startGame } from './application/use-cases/start-game.js';
import {
  createPlungerState,
  plungerPress,
  plungerRelease,
} from './application/use-cases/launch-ball.js';
import { createPaymentGateway } from './infrastructure/blockchain/payment-gateway-factory.js';
import {
  offerChallenge,
  pollChallenge,
  dismissChallenge,
  settleChallenge,
} from './application/use-cases/challenge-flow.js';
import { createChallengeBox } from './domain/challenge.js';
import { createInitialState } from './domain/game.js';
import type { InputSource } from './application/ports/input-source.js';
import type { GamePublisher } from './application/ports/game-publisher.js';

const physics = new RapierPhysicsWorld();
const publisher = new FastifyWsPublisher();
const mqttInput: InputSource = new MqttInputSource();

// Paid challenge (QR on the backglass): gateway picked from env (solana | fake).
const paymentGateway = createPaymentGateway();
const challengeBox = createChallengeBox();

const scoreRepo = new PostgresScoreRepo();
try {
  await scoreRepo.init();
} catch (err) {
  console.error('[score-repo] init failed, scores will not persist:', err);
}

await physics.init();

const state = createInitialState();

// Challenge reactions to the player starting a game:
// - plain start: hide an unpaid QR (free game; a paid challenge stays armed),
// - restart (R): full refresh — offer a fresh QR so the player can scan again
//   (it can be paid mid-game, the chain poll arms it for the current run).
const onGameStart = (): void => dismissChallenge(challengeBox, publisher);
const onGameRestart = (): void => {
  if (challengeBox.current?.status !== 'paid') {
    offerChallenge(paymentGateway, challengeBox, publisher);
  }
};

// Wraps the WS publisher: a game over settles a paid challenge (reward
// transfer), then a fresh QR is offered a few seconds later.
const gamePublisher: GamePublisher = {
  broadcast(event) {
    publisher.broadcast(event);
    if (event.type === 'game_over') {
      settleChallenge(paymentGateway, challengeBox, publisher, event.payload.finalScore)
        .catch((err) => console.error('[challenge] settlement failed:', err))
        .finally(() => {
          state.player.wallet = null; // next game is anonymous unless a new payment arrives
          setTimeout(() => offerChallenge(paymentGateway, challengeBox, publisher), 5000);
        });
    }
  },
};

const app = await buildApp({
  onWsConnect: (socket) => publisher.addClient(socket),
  physics,
  publisher: gamePublisher,
  state,
  scoreRepo,
  challengeBox,
  onGameStart,
  onGameRestart,
});

await startApp(app);

// First QR of the day, then poll the chain for the entry fee while it is offered.
offerChallenge(paymentGateway, challengeBox, publisher);
setInterval(() => {
  pollChallenge(paymentGateway, challengeBox, state, publisher).catch((err) =>
    console.error('[challenge] payment poll failed:', err),
  );
}, 3000);

// Physical buttons (ESP32 → MQTT): white right / white left = flippers,
// black left = start, black right = restart, front white = launch the ball.
const plunger = createPlungerState();
mqttInput.onButtonPress((side) => setFlipperState(physics, gamePublisher, side, true));
mqttInput.onButtonRelease((side) => setFlipperState(physics, gamePublisher, side, false));
mqttInput.onStart(() => {
  if (state.status !== 'running') {
    startGame(state, physics, gamePublisher);
    onGameStart();
  }
});
mqttInput.onRestart(() => {
  startGame(state, physics, gamePublisher);
  onGameRestart();
});
mqttInput.onPlunger((pressed) => {
  if (pressed) plungerPress(plunger);
  else plungerRelease(plunger, state, physics, gamePublisher);
});
mqttInput.connect();

const DT = 1 / 60;
setInterval(() => {
  tickGame(state, physics, gamePublisher, DT, scoreRepo);
}, DT * 1000);

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  stopApp(app)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
