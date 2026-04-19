import './game/world.js';
import { startServer } from './server/server.js';
import { createTable } from './game/table.js';

createTable();

await startServer();