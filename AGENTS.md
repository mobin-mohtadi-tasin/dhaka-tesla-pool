# Dhaka Tesla Pool — AI Development Guidelines

These instructions define the mandatory operational rules and engineering standards for any AI coding agent working in this repository. All rules must be strictly followed without exception.

## Core Principles

1. **Backend Integrity Over Visual Polish**: Prioritize transactional correctness, row-level concurrency safety, data integrity, and strict authorization over frontend visual flair or superficial UI design.
2. **Deterministic & Reproducible Behavior**: Avoid unpredictable heuristics, stochastic matching algorithms, or unverified assumptions. Logic must be testable, verifiable, and deterministic.
3. **Simplicity Over Cleverness**: Maintain minimal, robust abstractions. Do not introduce premature optimization, speculative generalized frameworks, or unnecessary design patterns.
4. **Zero Tolerance for Data Invariants Breach**: Invariants such as vehicle seat capacity, state machine valid transitions, and financial precision must never be violated under any concurrency conditions.

## Repository Context

- **Domain**: Dhaka Tesla Pool is an MVP seat-sharing and dynamic ride-pooling platform for battery-powered three-wheel rickshaws (locally nicknamed "Teslas") operating across designated transit corridors in Dhaka, Bangladesh.
- **Tech Stack**:
  - Frontend: Next.js + TypeScript
  - Backend: Node.js + Express + TypeScript
  - Database: PostgreSQL
  - ORM: Prisma
  - API Protocol: RESTful JSON
  - Testing: Vitest + Supertest
  - Orchestration: Docker Compose
- **Target Persona Vehicles**: Fixed-capacity vehicles (e.g., driver Jashim operating vehicle "Bullet" with exactly 3 passenger seats).

## Before Modifying Code

1. **Selective Context Gathering**: Read ONLY documentation and source files directly relevant to the active assignment. Do NOT index, scan, or read the entire repository.
2. **Architecture Compliance**: Verify that proposed modifications align with decisions recorded in `.ai/decisions.md` and `.ai/architecture.md`.
3. **Check Existing Tests**: Inspect existing unit, integration, and database tests in the relevant module to understand pre-existing expectations and contracts.
4. **Formulate Explicit Plan**: Formulate an atomic step-by-step implementation plan before writing any code.

## Scope Control

1. **No Scope Creep**: Confine changes strictly to the files and functions required to fulfill the specific prompt.
2. **Never Refactor Unrelated Code**: Do not clean up formatting, rename functions, reorganize imports, or optimize unrelated modules while working on a feature or bugfix.
3. **No Unjustified Dependencies**: Do NOT install any third-party packages, libraries, or tools unless explicitly required by the project specifications.
4. **No Infrastructure Inventions**: Do NOT add Redis, Kafka, RabbitMQ, Elasticsearch, Kubernetes, microservices, GraphQL, or external mapping/navigation cloud APIs. The architecture is deliberately a streamlined Docker Compose setup with Node.js and PostgreSQL.

## Architecture Rules

1. **Clear Layer Separation**:
   - `Controllers`: Parse requests, validate input types, invoke services, and format HTTP responses.
   - `Services`: Own domain logic, transaction boundaries, state transitions, and pooling business rules.
   - `Prisma / Repositories`: Manage raw database queries, schema interaction, and low-level data access.
2. **Server-Side Authority**: Frontend validation is purely for user experience. NEVER rely on frontend validation for business rules, constraints, authorization, or capacity checks. The backend must enforce all validation independently.
3. **Single Source of Truth**: PostgreSQL is the sole source of truth for seat capacity, ride statuses, and financial values. Application-level in-memory state counters are forbidden for concurrency control.
4. **Controlled State Transitions**: All status changes (e.g., ride requests, driver trips, pool memberships) must transition strictly through predefined legal states via dedicated state transition guards.

## Database Rules

1. **Explicit Transaction Boundaries**: Every operation that modifies concurrency-sensitive shared resources must use an appropriate PostgreSQL transaction strategy. For seat allocation and other capacity-sensitive operations, use row-level locking or another explicitly justified transactional mechanism. SERIALIZABLE isolation should only be used when required by the specific invariant.
2. **Seat Capacity Invariant**: The total number of confirmed passenger seat reservations in a pool must NEVER exceed the assigned vehicle's physical capacity.
3. **No Silent Schema Drift**: Never alter the database schema or Prisma schema without documenting the rationale and ensuring migration parity.
4. **Bypass Prohibition**: Never bypass database foreign keys, unique constraints, check constraints, or enum types using application-level workarounds.
5. **Financial Precision**: All monetary values (fares, payments, discounts) must be stored and computed as integer poysha (1 BDT = 100 poysha). Floating-point arithmetic for currency is strictly prohibited.

## Security Rules

1. **Strict Secrets Hygiene**: NEVER print, expose, hardcode, or commit secrets, API keys, passwords, or session tokens.
2. **Protect Environment Files**: NEVER modify or commit `.env` files containing live secrets or credentials. Use sanitized `.env.example` templates for configuration documentation.
3. **Robust Authorization**: Enforce strict authorization checks on every endpoint. A passenger must only access their own rides, profile, and fare breakdown. A driver must only access rides assigned to their vehicle or pool.
4. **No Authorization Weakening**: Never weaken, disable, or bypass authentication/authorization guards to make testing or feature development convenient.

## Testing Rules

1. **Targeted Execution**: Run only relevant, targeted tests during iteration. Avoid running entire massive test suites when modifying isolated modules.
2. **Mandatory Concurrency Tests**: Any code affecting seat allocation, booking acceptance, or cancellation must be tested against concurrent requests (e.g., simulating 2 passengers vying for the final 1 seat).
3. **Regression Tests**: Every bugfix must be accompanied by a regression test reproducing the failure before applying the fix.
4. **Static Verification**: Execute typecheck (`tsc --noEmit`) and linter checks where configured before declaring any task complete.

## Git Rules

1. **Atomic Commits**: Make small, cohesive, and logical commits that do one thing well.
2. **Meaningful Messages**: Write descriptive commit messages summarizing the "what" and "why" (e.g., `feat(pooling): enforce row-level locking during seat allocation`).
3. **Diff Inspection**: Review the entire `git diff` before committing or finalizing changes to ensure no extraneous files, debug logs, or inadvertent edits are included.

## Reporting Changes

When completing a task, the agent report must provide:
1. **Summary of Changes**: Concise overview of what was implemented or resolved.
2. **Files Modified/Created**: Complete list of touched file paths.
3. **Verification Performed**: Exact commands run (e.g., test suites, typecheck, lint) and their execution status/output.
4. **Invariants Preserved**: Explicit confirmation that concurrency, capacity, and security invariants remain unbroken.

## When to Stop and Ask

The AI agent must halt execution and ask the user for clarification when:
1. A requested feature contradicts an established architecture decision in `.ai/decisions.md` or `.ai/architecture.md`.
2. A requirement introduces ambiguity in the seat allocation or state transition logic that could compromise concurrency or transactional integrity.
3. A requested change implies adding external services, cloud infrastructures, or paid APIs outside the MVP scope.
