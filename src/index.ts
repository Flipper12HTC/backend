import './game/world.js';
import { startServer, broadcast } from './server/server.js';
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
