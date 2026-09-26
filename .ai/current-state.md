# Current Project State

## Phase

MVP implementation in progress.

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
- The concurrency test is skipped until `TEST_DATABASE_URL` points to a dedicated PostgreSQL test database.
- Docker Compose has not been executed because Docker is not installed on this machine.

## Submission work remaining

- Run migrations, seed, and the concurrency test against PostgreSQL; run the complete Docker Compose stack.
- Capture application screenshots and the six minute demo video.
- Arrange the requested `master`, `pre-release`, `release/v1.0.0`, and feature branch history, then publish an evaluator accessible repository.
- Add a public deployment URL if a free hosting option is available.
