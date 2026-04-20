import { world } from './world.js';
import { getBallPosition } from './ball.js';
import { broadcast } from '../server/server.js';

const TICK_RATE = 1000 / 60; // 60 FPS

export function startGameLoop(): void {
  setInterval(() => {
    // Rapier avance la simulation de 16ms
    world.step();

    // On récupère la position de la bille
    const pos = getBallPosition();

    broadcast({
      type: 'ball_position',
      payload: pos,
    });
  }, TICK_RATE);
}