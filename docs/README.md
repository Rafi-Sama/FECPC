# FECPC documentation

FECPC is the website and members' platform of a university competitive-programming club: a public site for
visitors and applicants, and a signed-in member area for training, community, events, money and club
administration.

Start with **Getting started** to run it, then **Architecture** to understand how it fits together.

| Document                                          | Read it when you want to…                                            |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| [Overview](overview.md)                           | know what the product does, area by area, and who can do what        |
| [Getting started](getting-started.md)             | run the project locally, seed it, and sign in                        |
| [Architecture](architecture.md)                   | understand the moving parts and how a request flows through them     |
| [Project structure](project-structure.md)         | find where a piece of code lives, and where new code should go       |
| [API reference](api-reference.md)                 | call or change an HTTP endpoint                                      |
| [Member-area actions](member-area-actions.md)     | add or change something a member can do (`act` types and queries)    |
| [Events](events.md)                               | event lifecycle, registration, responses, feedback, certificates     |
| [Roles and permissions](roles-and-permissions.md) | check who may do what; change the capability matrix                  |
| [Security](security.md)                           | understand sign-in, sessions, CSRF, rate limits and the threat model |
| [Database](database.md)                           | understand the tables, change the schema, or reseed                  |
| [Frontend](frontend.md)                           | work on pages, components, the client store or styling               |
| [Tailwind migration](tailwind-migration.md)       | convert styles to Tailwind, or check how the switch was verified     |
| [Testing](testing.md)                             | run or write tests                                                   |
| [Performance audit](performance-audit.md)         | check page speed at scale, or reproduce the load and Lighthouse runs |
| [Backend audit](backend-audit.md)                 | see what the API review checked, fixed, and left for a decision      |
| [Deployment](deployment.md)                       | run it in production: environment, proxies, health checks            |
| [Decisions and history](decisions.md)             | know why things are the way they are, and what is still missing      |
| [Contributing](contributing.md)                   | follow the conventions and the checklist before you push             |

Conventions used in these documents: paths are relative to the repository root; `pnpm …` commands run from
the root unless a directory is given.
