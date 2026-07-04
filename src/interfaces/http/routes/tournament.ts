import type { FastifyInstance } from 'fastify';
import type {
  GamePublisher,
  TournamentSummary,
} from '../../../application/ports/game-publisher.js';
import type { PaymentGateway } from '../../../application/ports/payment-gateway.js';
import type { PaymentStore } from '../../../application/ports/payment-store.js';
import type { TournamentRepo } from '../../../application/ports/tournament-repo.js';
import type { Tournament } from '../../../domain/tournament.js';
import { createMonoTournament } from '../../../application/use-cases/create-tournament.js';
import { joinTournament } from '../../../application/use-cases/join-tournament.js';
import { recordTournamentScore } from '../../../application/use-cases/record-tournament-score.js';
import { finalizeTournament } from '../../../application/use-cases/finalize-tournament.js';
import { cancelTournament } from '../../../application/use-cases/cancel-tournament.js';
import { refundPayment } from '../../../application/use-cases/refund-payment.js';
import { removeParticipant } from '../../../domain/tournament.js';
import { lamportsToSol } from '../../../domain/sol.js';
import { shortenWallet } from '../../../domain/wallet.js';

export interface TournamentDeps {
  repo: TournamentRepo;
  gateway: PaymentGateway;
  paymentStore: PaymentStore;
  publisher: GamePublisher;
}

function toSummary(t: Tournament): TournamentSummary {
  return {
    id: t.id,
    status: t.status,
    participants: t.participants.length,
    maxParticipants: t.config.maxParticipants,
    entryFeeSol: lamportsToSol(t.config.entryFeeLamports),
    prizeSol: lamportsToSol(t.config.prizeLamports),
    winnerShort: t.winner ? shortenWallet(t.winner) : null,
  };
}

export async function registerTournamentRoutes(
  app: FastifyInstance,
  deps: TournamentDeps,
): Promise<void> {
  const { repo, gateway, paymentStore, publisher } = deps;

  const broadcast = (t: Tournament): void => {
    publisher.broadcast({ type: 'tournament_update', payload: toSummary(t) });
  };

  app.post('/tournament/create', async (_req, reply) => {
    try {
      const t = createMonoTournament(repo, crypto.randomUUID(), Date.now());
      broadcast(t);
      return toSummary(t);
    } catch (err) {
      await reply.code(409).send({ error: err instanceof Error ? err.message : 'create failed' });
    }
  });

  app.get('/tournament/active', async () => {
    const t = repo.getActive();
    return t ? toSummary(t) : { active: false };
  });

  // Join after the entry-fee payment is confirmed on-chain.
  // The wallet is resolved from the paying transaction unless explicitly provided.
  app.post('/tournament/:id/join', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { wallet?: string; reference?: string };
    if (!body.reference) {
      await reply.code(400).send({ error: 'reference is required' });
      return;
    }
    const wallet = body.wallet ?? (await gateway.getPayerWallet(body.reference));
    if (!wallet) {
      await reply.code(400).send({ error: 'could not resolve payer wallet' });
      return;
    }
    try {
      const t = joinTournament(repo, paymentStore, id, wallet, body.reference, Date.now());
      publisher.broadcast({
        type: 'wallet_connected',
        payload: { walletShort: shortenWallet(wallet) },
      });
      broadcast(t);
      return toSummary(t);
    } catch (err) {
      await reply.code(400).send({ error: err instanceof Error ? err.message : 'join failed' });
    }
  });

  // Cancel one's entry -> refund the entry fee and drop the participant.
  app.post('/tournament/:id/leave', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { wallet?: string };
    const t = repo.get(id);
    if (!t || !body.wallet) {
      await reply.code(400).send({ error: 'tournament or wallet missing' });
      return;
    }
    const participant = t.participants.find((p) => p.wallet === body.wallet);
    if (!participant) {
      await reply.code(404).send({ error: 'participant not found' });
      return;
    }
    const { signature } = await refundPayment(
      gateway,
      paymentStore,
      participant.paymentReference,
      body.wallet,
    );
    const updated = removeParticipant(t, body.wallet, Date.now());
    repo.save(updated);
    publisher.broadcast({
      type: 'refund',
      payload: {
        walletShort: shortenWallet(body.wallet),
        amountSol: lamportsToSol(t.config.entryFeeLamports),
        signature,
      },
    });
    broadcast(updated);
    return toSummary(updated);
  });

  // Record a participant's final game score.
  app.post('/tournament/:id/score', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { wallet?: string; score?: number };
    if (!body.wallet || !Number.isFinite(Number(body.score))) {
      await reply.code(400).send({ error: 'wallet and score are required' });
      return;
    }
    try {
      const t = recordTournamentScore(repo, id, body.wallet, Number(body.score), Date.now());
      broadcast(t);
      return toSummary(t);
    } catch (err) {
      await reply.code(400).send({ error: err instanceof Error ? err.message : 'score failed' });
    }
  });

  // Normal end: pay the prize to the winner.
  app.post('/tournament/:id/finalize', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await finalizeTournament(repo, gateway, id, Date.now());
      if (result.winner && result.payoutSignature) {
        publisher.broadcast({
          type: 'payout',
          payload: {
            walletShort: shortenWallet(result.winner),
            amountSol: result.prizeSol,
            signature: result.payoutSignature,
          },
        });
      }
      broadcast(result.tournament);
      return { ...toSummary(result.tournament), payoutSignature: result.payoutSignature };
    } catch (err) {
      await reply.code(400).send({ error: err instanceof Error ? err.message : 'finalize failed' });
    }
  });

  // Abort: refund every participant.
  app.post('/tournament/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { tournament, refunds } = await cancelTournament(repo, gateway, id, Date.now());
      for (const r of refunds) {
        publisher.broadcast({
          type: 'refund',
          payload: {
            walletShort: shortenWallet(r.wallet),
            amountSol: r.amountSol,
            signature: r.signature,
          },
        });
      }
      broadcast(tournament);
      return { ...toSummary(tournament), refunds: refunds.length };
    } catch (err) {
      await reply.code(400).send({ error: err instanceof Error ? err.message : 'cancel failed' });
    }
  });
}
