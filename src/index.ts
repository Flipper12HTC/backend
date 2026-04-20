import './game/world.js';
import { startServer } from './server/server.js';
import { createTable } from './game/table.js';
import './game/ball.js';
import { startGameLoop } from './game/loop.js';

createTable();
startGameLoop();

await startServer();