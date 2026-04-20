import { app } from './app.js';

export { broadcast } from './ws/gateway.js';

export async function startServer(): Promise<void> {
  const host = process.env['HOST'] ?? '0.0.0.0';
  const port = Number(process.env['PORT'] ?? 8080);
  await app.listen({ port, host });
}

export async function stopServer(): Promise<void> {
  await app.close();
}
