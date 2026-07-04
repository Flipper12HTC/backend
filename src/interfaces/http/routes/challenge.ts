import type { FastifyInstance } from 'fastify';
import type { ChallengeBox } from '../../../domain/challenge.js';
import { toChallengeView } from '../../../domain/challenge.js';

// Read-only snapshot so a screen that (re)loads can render the current QR
// without waiting for the next challenge_updated event.
export async function registerChallengeRoutes(
  app: FastifyInstance,
  box: ChallengeBox,
): Promise<void> {
  app.get('/challenge', async () => toChallengeView(box.current));
}
