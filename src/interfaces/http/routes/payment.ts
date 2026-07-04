import type { FastifyInstance } from 'fastify';
import type { GamePublisher } from '../../../application/ports/game-publisher.js';
import type { PaymentGateway } from '../../../application/ports/payment-gateway.js';
import type { PaymentStore } from '../../../application/ports/payment-store.js';
import { startPayment } from '../../../application/use-cases/start-payment.js';
import { refreshPayment } from '../../../application/use-cases/refresh-payment.js';
import { refundPayment } from '../../../application/use-cases/refund-payment.js';
import { toProgress } from '../../../domain/payment.js';
import { shortenWallet } from '../../../domain/wallet.js';

export interface PaymentDeps {
  gateway: PaymentGateway;
  store: PaymentStore;
  publisher: GamePublisher;
}

export async function registerPaymentRoutes(
  app: FastifyInstance,
  deps: PaymentDeps,
): Promise<void> {
  const { gateway, store, publisher } = deps;

  // Create a payment request -> returns the QR URL + reference to poll.
  app.post('/payment/request', async (req, reply) => {
    const body = (req.body ?? {}) as { amountSol?: number; label?: string; message?: string };
    const amountSol = Number(body.amountSol);
    if (!Number.isFinite(amountSol) || amountSol <= 0) {
      await reply.code(400).send({ error: 'invalid amountSol' });
      return;
    }
    const label = body.label ?? 'Flipper 12';
    const message = body.message ?? 'Payment';
    const { intent, url } = startPayment(gateway, store, amountSol, label, message, Date.now());
    const progress = toProgress(intent);
    publisher.broadcast({ type: 'payment_progress', payload: progress });
    return { url, ...progress };
  });

  // Poll a payment: re-reads the chain, updates status (pending -> partial -> confirmed).
  app.get('/payment/:reference', async (req, reply) => {
    const { reference } = req.params as { reference: string };
    const intent = await refreshPayment(gateway, store, reference);
    if (!intent) {
      await reply.code(404).send({ error: 'payment not found' });
      return;
    }
    const progress = toProgress(intent);
    publisher.broadcast({ type: 'payment_progress', payload: progress });
    return progress;
  });

  // Refund a payment (entry cancellation). The destination wallet is resolved from the
  // paying transaction when not provided, so the screen can cancel without knowing it.
  app.post('/payment/:reference/refund', async (req, reply) => {
    const { reference } = req.params as { reference: string };
    const body = (req.body ?? {}) as { wallet?: string };

    const existing = store.get(reference);
    const needsTransfer = existing !== undefined && existing.receivedLamports > 0;
    const wallet = body.wallet ?? (needsTransfer ? await gateway.getPayerWallet(reference) : null);
    if (needsTransfer && !wallet) {
      await reply.code(400).send({ error: 'could not resolve wallet to refund' });
      return;
    }
    try {
      const { intent, signature } = await refundPayment(gateway, store, reference, wallet ?? 'n/a');
      const progress = toProgress(intent);
      publisher.broadcast({
        type: 'refund',
        payload: {
          walletShort: wallet ? shortenWallet(wallet) : 'XXX...XXX',
          amountSol: progress.receivedSol,
          signature,
        },
      });
      publisher.broadcast({ type: 'payment_progress', payload: progress });
      return { ok: true, status: intent.status, signature };
    } catch (err) {
      await reply.code(400).send({ error: err instanceof Error ? err.message : 'refund failed' });
    }
  });
}
