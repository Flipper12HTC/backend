# flipper12-backend

Central nervous system of **Flipper 12**: game engine, MQTT bridge, WebSocket gateway, persistence, and Solana integration.

See `flipper12-product` for the full project spec, CDC, and backlog.

## Stack

- Node.js 20+ / TypeScript strict
- Fastify + @fastify/websocket
- MQTT (`mqtt` client, broker: Mosquitto via Docker)
- Cannon.js (`cannon-es`) for physics
- Zod for validation and cross-repo contracts
- Pino for structured logging
- PostgreSQL (`postgres` by porsager) + Redis (`ioredis`)
- Native Node test runner (`node --test`)

## Prerequisites

- Node.js >= 20
- npm >= 10
- Docker Desktop (for Mosquitto, Postgres, Redis)

## Quick start

```powershell
npm install
npm run dev
```

You should see startup logs. No real server yet — this is a skeleton.

## Scripts

- `npm run dev` — dev mode with auto-reload
- `npm run build` — compile TypeScript to `dist/`
- `npm start` — run the compiled build
- `npm run typecheck` — type-check without emitting
- `npm test` — run native Node test runner
- `npm run format` — format all files with Prettier

## Structure

```
src/
├── server/       Fastify app, REST routes, WebSocket handlers
├── mqtt/         MQTT subscriber, message dispatcher
├── game/         Game loop, physics, scoring (hot path, 16ms budget)
├── blockchain/   Solana client, wallet sessions, Anchor workers
├── storage/      PostgreSQL and Redis adapters
└── shared/       Logger, env validation, errors, utils

contracts/        Zod schemas shared across repos (MQTT, WS, REST)
programs/         Anchor on-chain programs (Rust) — empty for now
tests/            Unit and integration tests
scripts/          Dev utilities (mock hardware, seed db)
docker/           Dockerfile and docker-compose.yml — empty for now
```
