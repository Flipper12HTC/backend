import './game/world.js';
import { startServer } from './server/server.js';
import { createTable } from './game/table.js';
import './game/ball.js';

createTable();

await startServer();