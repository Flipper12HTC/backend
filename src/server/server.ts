import Fastify from 'fastify';
import websocket from '@fastify/websocket';

const clients = new Set<import('@fastify/websocket').WebSocket>();

export const server = Fastify({ logger: true });

await server.register(websocket);

server.get('/ws', { websocket: true }, (socket) => {
  clients.add(socket);

  server.log.info('Client connected');

  socket.on('close', () => {
    clients.delete(socket);
    server.log.info('Client disconnected');
  });
});

export function broadcast(data: unknown): void {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(msg);
    }
  }
}

export async function startServer(port = 8080): Promise<void> {
  await server.listen({ port, host: '0.0.0.0' });
}