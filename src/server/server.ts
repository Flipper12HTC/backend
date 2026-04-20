import { app } from './app.js';

export { broadcast } from './ws/gateway.js';

export async function startServer(port = 8080): Promise<void> {
  await app.listen({ port, host: '0.0.0.0' });
}
