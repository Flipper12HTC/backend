import { stepWorld, getBallPosition } from './physics.js';
import { broadcast } from '../server/server.js';

const DT = 1 / 60;

export function startGameLoop(): void {
  setInterval(() => {
    stepWorld(DT);
    broadcast({ type: 'ball_position', payload: getBallPosition() });
  }, DT * 1000);
}