# flipper12-backend

Central nervous system of **Flipper 12**: game engine, MQTT bridge, WebSocket gateway, persistence, and Solana integration.

See `flipper12-product` for the full project spec, CDC, and backlog.

## Stack

- Node.js 20+ / TypeScript strict
- Fastify + @fastify/websocket
- MQTT (`mqtt`, broker Mosquitto via Docker)
- Rapier (`@dimforge/rapier3d-compat`) pour la physique
- PostgreSQL (`postgres` by porsager) + Redis (`ioredis`)
- Native Node test runner (`node --test`)

## Prerequisites

- Node.js >= 20
- npm >= 10
- Docker Desktop (for Mosquitto, Postgres, Redis)

## Quick start

```powershell
npm install
npm run docker:up
npm run dev
```

You should see startup logs. No real server yet — this is a skeleton.

## Scripts

- `npm run dev` — mode dev avec rechargement auto
- `npm run build` — compilation TypeScript vers `dist/`
- `npm start` — lance la version compilée
- `npm run typecheck` — vérif des types sans emit
- `npm test` — tests via le test runner natif Node
- `npm run format` — formatage avec Prettier
- `npm run docker:up` — démarre Mosquitto, Postgres, Redis en arrière-plan
- `npm run docker:down` — stoppe les services Docker

## Structure

```
src/
├── server/       Fastify, routes REST, handlers WebSocket
├── mqtt/         Subscriber MQTT, dispatcher
├── game/         Game loop, physique, scoring (hot path, budget 16ms)
├── blockchain/   Client Solana, sessions wallet, workers Anchor
├── storage/      Adaptateurs PostgreSQL et Redis
└── shared/       Utils partagés, erreurs

contracts/        Contrats partagés (MQTT, WS, REST)
programs/         Programmes Anchor on-chain (Rust) — vide pour l'instant
tests/            Tests unitaires et d'intégration
scripts/          Utilitaires de dev (mock hardware, seed db)
docker/           Dockerfile et docker-compose.yml — vide pour l'instant
```
