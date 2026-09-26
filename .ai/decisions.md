# Architecture Decision Records (ADRs)

This document records the foundational architectural decisions for Dhaka Tesla Pool.

---

# ADR-001: PostgreSQL

Status: Accepted

## Context
The system requires strict relational consistency, ACID guarantees, transactional isolation, and row-level locking to guarantee that fixed-capacity vehicles (such as 3-seat electric rickshaws) are never overbooked under concurrent passenger requests.

## Decision
We choose PostgreSQL as the primary and sole relational database for the application.

## Consequences
- **Positive**: Native row-level locking (`SELECT ... FOR UPDATE`), robust foreign key constraints, check constraints, enum support, and ACID transactions provide rock-solid concurrency safety.
- **Negative**: Requires relational schema migrations and a running PostgreSQL instance (managed locally via Docker).

---

# ADR-002: REST API

Status: Accepted

## Context
The application needs a simple, universally understood communication protocol between the Next.js frontend and the Express backend. The API surface consists of standard CRUD and state transition RPC operations.

## Decision
We adopt a RESTful JSON API using standard HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`), semantic status codes, and JSON payloads.

## Consequences
- **Positive**: Simple, standard, easily tested via Supertest/curl, with minimal client-side runtime overhead. Avoids GraphQL or gRPC schema overhead.
- **Negative**: Lacks real-time duplex streaming out-of-the-box (polling or server-sent events can be used if needed for status updates).

---

# ADR-003: Express

Status: Accepted

## Context
The backend requires a lightweight, unopinionated, and battle-tested HTTP web framework in TypeScript to host REST endpoints, route requests, and run authentication and error-handling middlewares.

## Decision
We select Node.js with Express and TypeScript for the backend server.

## Consequences
- **Positive**: Minimalist, universally familiar, extensive ecosystem of middleware (CORS, body-parser, JWT), fast startup, and seamless integration with Supertest for API integration tests.
- **Negative**: Lacks built-in opinionated structure (must enforce controller/service/repository boundaries by convention).

---

# ADR-004: Prisma

Status: Accepted

## Context
The application requires typesafe database interactions, reliable migrations, and structured queries without the fragility of manual raw SQL string concatenation, while still supporting explicit transactions and row locking.

## Decision
We use Prisma as the ORM and query builder for PostgreSQL.

## Consequences
- **Positive**: End-to-end TypeScript safety generated directly from schema files, declarative migrations via Prisma Migrate, and seamless interactive transaction support (`prisma.$transaction`).
- **Negative**: Advanced row-locking patterns (`SELECT FOR UPDATE`) require Prisma raw queries (`$queryRaw`) inside interactive transactions.

---

# ADR-005: Integer Poysha Money

Status: Accepted

## Context
Ride fares, pooling discounts, and driver earnings involve monetary calculations. Using floating-point numbers (`Float` / `Double`) causes IEEE 754 precision issues and cumulative rounding discrepancies (e.g., `0.1 + 0.2 !== 0.3`).

## Decision
All monetary values are stored, calculated, and transmitted as integer poysha:
- 1 BDT = 100 poysha
- Example: ৳25.50 is represented as `2550` poysha.
- Database fields use `INTEGER` or `BIGINT`.

## Consequences
- **Positive**: Completely eliminates floating-point rounding errors and currency discrepancies across calculations, database storage, and API responses.
- **Negative**: Requires conversion logic at the presentation layer when displaying human-readable BDT (`৳25.50`) to passengers.

---

# ADR-006: Predefined Dhaka Zones & Deterministic Route Compatibility

Status: Accepted

## Context
Dynamic pooling requires determining route compatibility between passengers. Full GIS map engines (Google Maps API, Mapbox, OSRM) introduce high financial cost, external network latency, network failure points, and non-deterministic routing for local battery rickshaws.

## Decision
Transit corridors are mapped as discrete, predefined Dhaka zones (`BANANI`, `MOHAKHALI`, `GULSHAN_1`, `GULSHAN_2`, etc.).
Route compatibility is evaluated via a small, deterministic rule engine based on canonical corridor IDs and travel headings rather than geographic proximity algorithms:
- Routes sharing the same corridor heading (e.g. `BANANI → MOHAKHALI` and `BANANI → GULSHAN_1` on `CORRIDOR_BANANI_SOUTH`) evaluate to `COMPATIBLE: YES`.
- Disjoint or opposite routes (e.g. `BANANI → MOHAKHALI` vs `MIRPUR → UTTARA` or `MOHAKHALI → BANANI`) evaluate to `COMPATIBLE: NO`.

## Consequences
- **Positive**: Zero external API costs, 100% deterministic matching logic that evaluators can reliably reproduce, zero network dependency, and instant in-memory or database evaluation.
- **Negative**: Finer-grained door-to-door address navigation is not supported; pickups and drop-offs are centered around defined neighborhood nodes.

---

# ADR-007: PostgreSQL Transaction/Row Locking & Seat Counter Strategy

Status: Accepted

## Context
When a vehicle has only 1 remaining seat (e.g., Jashim's "Bullet" already holding 2 passengers out of 3), multiple passengers (e.g., Shirin and another user) may simultaneously attempt to claim the last seat.
Additionally, tracking seat occupancy presents two architectural options:
1. *Normalized dynamic aggregation*: Calculating `SUM(seats_allocated)` dynamically and locking the `vehicles` row.
2. *Denormalized atomic counter*: Storing `pools.occupied_seats` directly and locking the target `pools` row.

## Decision
We adopt the **atomic denormalized counter** model (`pools.occupied_seats`) coupled with row-level locking on the target pool record (`SELECT ... FOR UPDATE FROM pools`).

All seat allocations execute inside an interactive PostgreSQL transaction owned by the Service Layer:
1. The service begins an interactive transaction.
2. The pool row is locked with `FOR UPDATE`.
3. The service verifies the capacity invariant (`occupied_seats + requested <= capacity`).
4. If valid, the membership record is inserted, `occupied_seats` is incremented, and status updated.
5. If invalid, the transaction aborts and returns an out-of-capacity error.

The strict database invariant is maintained:
`pool.occupied_seats == SUM(pool_memberships.seats_allocated)` across all commits.

## Consequences
- **Positive**: Extremely fast indexed candidate pool matching (`WHERE status = 'OPEN' AND (capacity - occupied_seats) >= requested`) without joining `pool_memberships`. Provides a clean, isolated row lock on the pool row without bottlenecking the vehicle entity. Concurrency safety is simple to explain, test, and demonstrate during evaluation.
- **Positive**: Mathematically prevents overcapacity under concurrent booking attempts on PostgreSQL.
- **Negative**: Requires strict discipline: `occupied_seats` must NEVER be modified outside of the transaction creating or removing pool memberships. Serializes allocations for the same pool during the brief interactive transaction window. Note: This design is optimized for MVP correctness and data integrity, and is not yet claiming horizontal multi-master scalability.

---

# ADR-008: Docker Compose

Status: Accepted

## Context
Evaluators, developers, and automated test runners need to spin up the complete application stack (PostgreSQL database, Express backend, Next.js frontend) with a single command without installing local database binaries or configuration mismatches.

## Decision
We define a unified `docker-compose.yml` orchestrating the PostgreSQL database container along with containerized backend and frontend services, configured via environment variables.

## Consequences
- **Positive**: One-command reproducible local and staging environment (`docker compose up --build`), consistent across macOS, Linux, and Windows.
- **Negative**: Requires Docker daemon installed on the host machine during full containerized testing.