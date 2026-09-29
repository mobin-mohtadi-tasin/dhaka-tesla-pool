# Project structure

The two npm workspaces remain `apps/api` (Express backend) and `apps/web` (Next.js frontend). Root scripts and Docker Compose continue to use those paths.

## Backend

- `src/app.ts`: assembles middleware and mounts routers.
- `src/server.ts`: starts HTTP listening and handles shutdown.
- `src/routes/`: auth, ride, vehicle, and driver URL definitions and authorization guards.
- `src/controllers/`: parse requests, call services, and format responses.
- `src/validation/requests.ts`: Zod schemas for incoming HTTP requests.
- `src/middleware/`: signed cookie authentication, role checks, and error responses.
- `src/services/`: auth, rides, and driver business workflows; transaction ownership stays here.
- `src/domain/pooling.ts`: deterministic routes, integer poysha fares, and state transition rules.
- `src/repositories/poolRepository.ts`: row locks and transactional ride persistence helpers.
- `src/database/client.ts`: shared Prisma client.
- `src/shared/`: HTTP errors and async handler adapter.
- `prisma/schema.prisma`: database models and enums.
- `prisma/migrations/`: versioned SQL migrations and database constraints.
- `prisma/seed.ts`: idempotent demo account creation.
- `test/`: domain, HTTP contract, and PostgreSQL concurrency tests.

For a new endpoint, add the route and authorization guard, controller, and input schema. Put business decisions and transactions in services, pure rules in domain, and row-lock helpers in repositories. Controllers do not query Prisma directly.

## Frontend

- `app/`: Next.js route entry files, root layout, and global styles.
- `features/auth/auth-screen.tsx`: landing page and authentication screen.
- `features/passenger/passenger-screen.tsx`: booking, fares, and passenger history.
- `features/driver/driver-screen.tsx`: availability, pool manifest, and trip actions.
- `features/map/components/route-map.tsx`: interactive offline map.
- `features/map/lib/`: map geometry and representative zone data.
- `components/ui.tsx`: shared branding, dashboard, icons, seat display, and trip progress.
- `lib/api.ts`: same-origin HTTP client.
- `lib/format.ts`: BDT and label display formatting.
- `types/api.ts`: shared API response types.
- `public/maps/`: bundled map data and attribution.
- `test/map.test.mjs`: map geometry and source-data verification.

Routes re-export their feature screen. Shared UI stays outside `app` so routing files are easy to locate. The existing `@/` alias resolves from the web workspace root.

## Database migrations

This source reorganization does not change database models, tables, constraints, or existing migration history. No new SQL migration is necessary. Use Prisma's deployment command to apply pending checked-in migrations without resetting existing data:

```text
npm run db:generate -w @dtp/api
npm run db:migrate -w @dtp/api
npm exec -w @dtp/api -- prisma migrate status
```

Set `DATABASE_URL` in the shell to the intended PostgreSQL database first. Keep credentials out of committed files. `db:seed` also requires `DEMO_PASSWORD` with at least 10 characters; it creates absent demo accounts and does not change passwords for existing users.

For concurrency verification, use a separate database whose name ends in `_test`. Apply migrations there with `DATABASE_URL`, then set `TEST_DATABASE_URL` to that database and run `npm run test -w @dtp/api`. The concurrency suite writes test records and must never target the application database.

## Verification

```text
npm run typecheck
npm run lint
npm run test -w @dtp/api
node --experimental-strip-types --test apps/web/test/map.test.mjs
npm run build
```

## Reorganization file inventory

Moved files (source ? destination):

- `apps/api/src/auth.ts` ? `apps/api/src/middleware/auth.ts`
- `apps/api/src/db.ts` ? `apps/api/src/database/client.ts`
- `apps/api/src/domain.ts` ? `apps/api/src/domain/pooling.ts`
- `apps/api/src/errors.ts` ? `apps/api/src/shared/httpError.ts`
- `apps/api/src/repositories.ts` ? `apps/api/src/repositories/poolRepository.ts`
- `apps/web/app/components/ui.tsx` ? `apps/web/components/ui.tsx`
- `apps/web/app/components/route-map.tsx` ? `apps/web/features/map/components/route-map.tsx`
- `apps/web/lib/map-geometry.ts` ? `apps/web/features/map/lib/map-geometry.ts`
- `apps/web/lib/map-zones.ts` ? `apps/web/features/map/lib/map-zones.ts`
- `apps/web/app/page.tsx` ? `apps/web/features/auth/auth-screen.tsx` (route entry recreated)
- `apps/web/app/passenger/page.tsx` ? `apps/web/features/passenger/passenger-screen.tsx` (route entry recreated)
- `apps/web/app/driver/page.tsx` ? `apps/web/features/driver/driver-screen.tsx` (route entry recreated)

Other modified files:

- `README.md`
- `apps/api/src/app.ts`
- `apps/api/src/server.ts`
- `apps/api/src/services/authService.ts`
- `apps/api/src/services/rideService.ts`
- `apps/api/src/services/driverService.ts`
- `apps/api/test/domain.test.ts`
- `apps/api/test/concurrency.test.ts`
- `apps/web/lib/api.ts`
- `apps/web/package.json`
- `apps/web/test/map.test.mjs`
- `docs/map.md`

Created files:

- `apps/api/src/controllers/authController.ts`
- `apps/api/src/controllers/rideController.ts`
- `apps/api/src/controllers/driverController.ts`
- `apps/api/src/routes/authRoutes.ts`
- `apps/api/src/routes/rideRoutes.ts`
- `apps/api/src/routes/driverRoutes.ts`
- `apps/api/src/routes/vehicleRoutes.ts`
- `apps/api/src/validation/requests.ts`
- `apps/api/src/middleware/errorHandler.ts`
- `apps/api/src/shared/asyncRoute.ts`
- `apps/api/test/http.test.ts`
- `apps/web/lib/format.ts`
- `apps/web/types/api.ts`
- `docs/project-structure.md`

Existing uncommitted UI styles, map assets, and the map generation script were preserved. No Prisma schema, SQL migration, environment file, or dependency was changed.

## Verification results (2026-09-29)

- `npm.cmd run typecheck`: passed both workspaces (`tsc --noEmit`).
- `npm.cmd run lint`: passed both workspaces, including all new frontend folders.
- `npm.cmd run test -w @dtp/api`: 9 tests passed, including the real PostgreSQL last-seat concurrency test; no tests skipped. `TEST_DATABASE_URL` pointed to the separate `dhaka_tesla_pool_structure_test` database.
- `node --experimental-strip-types --test apps/web/test/map.test.mjs`: 5 tests passed. Node emitted its existing module-type warning; no test failures.
- `npm.cmd run build`: API compilation and Next.js production build passed for `/`, `/passenger`, and `/driver`.
- `npm.cmd run db:migrate -w @dtp/api`: application database had no pending migrations; initial migration applied successfully to the separate test database.
- `npm.cmd exec -w @dtp/api -- prisma migrate status`: application database schema up to date.
- `git diff --check`: passed.
- HTTP requests with `Invoke-WebRequest`: `/`, `/passenger`, `/driver`, API `/health`, passenger and driver login, authenticated `/auth/me`, fare quote, and driver vehicle lookup returned HTTP 200 through the running local application. The quote remained 2,500 integer poysha.

PostgreSQL row locks, capacity constraints, service-owned transactions, legal state transitions, integer poysha calculations, signed session cookies, role checks, and ownership restrictions are preserved. Existing domain, authentication, database client, and locking helper bodies were compared to their originals; changes there are import paths only.

The restarted frontend runs at `http://localhost:3000` and API at `http://localhost:4000`. The API connection and session secret were supplied in process environment; no credentials were written to tracked files. Restarting the API requires supplying its environment again. Previously issued sessions may require signing in again after the API restart.
