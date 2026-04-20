import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';

const clients = new Set<WebSocket>();

export async function registerGameGateway(app: FastifyInstance): Promise<void> {
  app.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket);
    app.log.info(`WS client connected (${clients.size} total)`);

    socket.on('close', () => {
      clients.delete(socket);
      app.log.info(`WS client disconnected (${clients.size} total)`);
    });
  });
}

export function broadcast(payload: unknown): void {
  const msg = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}
