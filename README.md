# FECPC

The website and members' platform of a university competitive-programming club: a public site, and a
member area for training, community, events, dues and club administration.

```sh
pnpm install
docker compose up -d                                   # PostgreSQL on 127.0.0.1:5433
cp apps/api/.env.example apps/api/.env.local            # set SEED_PASSWORD
pnpm db:setup                                           # schema + placeholder club
pnpm dev                                                # web :3000, API :3001
```

Sign in at <http://localhost:3000/login> as `tanvir@fecpc.example` (President), `anika@` (Treasurer),
`tasnim@` (Member) or any other seeded account, with your `SEED_PASSWORD`.

| | |
| --- | --- |
| `apps/web` | Next.js 16 site and member area; proxies `/api/*` to the API |
| `apps/api` | NestJS + Fastify API: auth, sessions, the member area's actions and state |
| `packages/contracts` | rules and shapes both apps share (roles, permissions, XP, `AppState`) |
| `packages/content` | the club's static content |

Everything else is in **[docs/](docs/README.md)**: architecture, API, permissions, security, database,
frontend, testing, deployment, and the decisions behind them.
