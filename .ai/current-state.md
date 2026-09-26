# Current Project State

## Phase

MVP implemented and integration verified; submission materials remain.

## Implemented

- Next.js passenger and driver flows with sign in, booking, fare, status, history, manifest, and driver trip actions.
- Express API with server side validation, role and ownership checks, and signed HTTP only cookie sessions.
- Prisma schema, checked in PostgreSQL migration, and demo seed data for Jashim, Bullet, Nusrat, Rafiq, Shirin, and Ashik.
- Deterministic corridor matching, integer poysha fare calculation, guarded state transitions, and transaction based seat allocation.
- Docker Compose definition for web, API, and PostgreSQL with health checks.
- Focused unit tests and a PostgreSQL concurrency test.

## Verification on this workstation

- Prisma schema validation and client generation passed.
- Typecheck, lint, unit tests, and production builds passed.
- Docker Compose built and started the web, API, and PostgreSQL services; all three health checks passed.
- The checked in migration applied to the isolated test database. All four API tests passed there, including the concurrent final-seat booking test.
- The web-to-API `/api/health` route returned `{"status":"ok"}` from the live stack.

## Submission work remaining

- Capture application screenshots and the six minute demo video.
- Feature branches have been merged to `master`, and `pre-release` has passed integration checks. Cut `release/v1.0.0`, then publish an evaluator accessible repository.
- Add a public deployment URL if a free hosting option is available.
