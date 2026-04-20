import './game/world.js';
import { startServer, stopServer, broadcast } from './server/server.js';
import { createTable } from './game/table.js';
import './game/ball.js';
import { startGameLoop } from './game/loop.js';
import { startMqttClient } from './mqtt/client.js';

createTable();
startGameLoop();

await startServer();

startMqttClient();

setInterval(() => {
  broadcast({ type: 'tick', timestamp: Date.now() });
}, 1000);

function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  stopServer()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
