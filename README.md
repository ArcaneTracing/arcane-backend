# Arcane Backend

Backend API for Arcane — a platform for managing LLM traces, conversations, evaluations, experiments, and observability.

**Website:** [www.arcanetracing.com](https://www.arcanetracing.com)

Built with [NestJS](https://nestjs.com/), TypeScript, PostgreSQL, and optional integrations with RabbitMQ/Kafka, Redis, and OpenTelemetry.

## Features

- **Traces & Conversations** — Ingest and query traces from Tempo, Jaeger, ClickHouse, or custom APIs
- **Evaluations & Experiments** — Run evaluations and experiments with streaming results
- **Projects & Organisations** — Multi-tenant structure with RBAC
- **Datasources** — Configure trace backends per project
- **Datasets & Prompts** — Manage evaluation datasets and prompt templates
- **Authentication** — Better Auth with email/password and optional Okta SAML SSO
- **Audit** — Audit trail for state-changing operations

## Prerequisites

- **Node.js** 24+
- **PostgreSQL** 14+
- **RabbitMQ** or **Kafka** (for evaluation/experiment job queues)
- Optional: **Redis** (for caching; falls back to in-memory)
- Optional: **ClickHouse** (as trace backend; configurable per datasource)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env-example .env
# Edit .env with your values — see Environment Variables below
```

### 3. Run local services

```bash
cd localsetup && docker-compose up -d postgres
```

This starts PostgreSQL with `arcanedb` (user/password from `.env`).

### 4. Run migrations

```bash
npm run migration:run
```

### 5. Start the application

```bash
npm run start:dev
```

The API is available at `http://localhost:8085` and Swagger docs at `http://localhost:8085/api-docs`.

## Environment Variables

Copy `.env-example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL URL: `postgresql://user:password@host:port/database` |
| `BETTER_AUTH_SECRET` | Yes | Secret for auth tokens (e.g. `openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | Yes | Backend base URL (e.g. `http://localhost:8085`) |
| `FRONTEND_URL` | No | Comma-separated CORS origins (default: `http://localhost:3000`) |
| `MESSAGE_BROKER` | No | `rabbitmq` (default) or `kafka` |
| `RABBITMQ_URL` | No | e.g. `amqp://guest:guest@localhost:5672/` |
| `REDIS_ENABLED` | No | `true` to use Redis cache |
| `REDIS_URL` | No | Redis URL when `REDIS_ENABLED=true` |
| `API_KEY_SALT` | No | Salt for project API keys (public API) |
| `ENCRYPTION_KEY` | No | For encrypting model config credentials |

See `.env-example` for the full list, including SMTP, Okta SSO, retention, and cache options.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start in development mode |
| `npm run start:dev` | Start with watch (hot reload) |
| `npm run start:prod` | Start production build |
| `npm run build` | Compile TypeScript |
| `npm run test` | Run unit tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run test:e2e` | Run E2E tests (Testcontainers) |
| `npm run lint` | Lint and fix |
| `npm run format` | Format with Prettier |
| `npm run migration:generate -- migrations/Name` | Generate migration from entity changes |
| `npm run migration:run` | Run pending migrations |
| `npm run migration:revert` | Revert last migration |
| `npm run db:reset` | Reset database (dev) |
| `npm run sonar:start` | Start SonarQube locally |
| `npm run sonar` | Run SonarQube scan (Docker) |

## API Documentation

When the app is running, Swagger UI is available at:

**http://localhost:8085/api-docs**

Supports Bearer JWT, API keys, and explore/try endpoints interactively.

## Project Structure

```
src/
├── app.module.ts          # Root module
├── main.ts                # Bootstrap
├── auth.ts                # Better Auth config
├── auth/                  # Auth guards, sessions
├── audit/                 # Audit logging
├── common/                # Shared modules (cache, encryption, message-broker)
├── organisations/        # Organisation CRUD
├── projects/              # Project management
├── datasources/           # Trace backend configs (Tempo, Jaeger, ClickHouse, custom)
├── traces/                # Trace search and retrieval
├── conversations/        # Conversation management
├── datasets/              # Evaluation datasets
├── evaluations/           # Evaluations and stats
├── experiments/           # Experiments
├── scores/                # Score management
├── prompts/               # Prompt templates
├── entities/              # Entity extraction
├── rbac/                  # Roles and permissions
├── retention/             # Data retention jobs
└── license/               # License checks
```

## Docker

### Build

```bash
docker build -t arcane-backend .
```

### Run

```bash
docker run -p 8085:8085 \
  -e DATABASE_URL=postgresql://... \
  -e BETTER_AUTH_SECRET=... \
  -e BETTER_AUTH_URL=http://localhost:8085 \
  arcane-backend
```

Use `-e` or `--env-file` for all required env vars.

## Local Setup (Docker Compose)

The `localsetup/` directory provides:

- **Postgres** — Default DB for local development
- **Tempo** — Tracing backend (optional)
- **OpenTelemetry Collector** — OTLP receiver (optional)
- **SonarQube** — Code quality (commented out; uncomment and use `npm run sonar:start`)

```bash
cd localsetup
docker-compose up -d
```

## Database Migrations

Migrations live in `migrations/` and use TypeORM:

```bash
# Generate from entity changes
npm run migration:generate -- migrations/AddNewColumn

# Create empty migration
npm run migration:create -- migrations/AddNewColumn

# Run all pending
npm run migration:run

# Revert last
npm run migration:revert

# List status
npm run migration:show
```

## Message Broker

Evaluation and experiment jobs use a message broker. Set `MESSAGE_BROKER` to:

- **rabbitmq** (default) — Use `RABBITMQ_URL`
- **kafka** — Use `KAFKA_BROKERS` and related vars

Both the NestJS backend and the Python worker must use the same broker.

## Caching

- **In-memory** — Default, no config
- **Redis** — Set `REDIS_ENABLED=true` and `REDIS_URL` for shared cache

## Testing

- **Unit tests**: `npm run test`
- **Coverage**: `npm run test:cov` (thresholds: 75% branches, functions, lines, statements)
- **E2E**: `npm run test:e2e` (uses Testcontainers for Postgres)

## Code Quality

- ESLint + Prettier for style and lint
- SonarQube integration (`sonar-project.properties`)
- Coding standards in `.cursorrules`

## License

See [LICENSE](LICENSE).
