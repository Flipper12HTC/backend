import { createWorld, stepWorld, getBallPosition } from '../src/game/physics.js';
import { createPlayfield } from '../src/game/playfield.js';

await createWorld();
createPlayfield();

const DT = 1 / 60;
const TICKS = Math.floor(5 / DT); // 5 seconds

console.log('t(s),x,y,z');

for (let i = 0; i < TICKS; i++) {
  stepWorld(DT);
  const t = ((i + 1) * DT).toFixed(3);
  const { x, y, z } = getBallPosition();
  console.log(`${t},${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`);
}
