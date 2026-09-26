# Verification Workflow and Test Levels

This document outlines the standard verification levels required across the Dhaka Tesla Pool codebase, establishing clear criteria for when each level of testing must be employed.

---

## Verification Levels

### 1. Unit Tests
- **Scope**: Isolated domain logic, pure functions, state machine transition validators, and utility calculations.
- **Examples**: Zone compatibility matching logic, per-passenger fare calculation in poysha, route sequence validation.
- **When Appropriate**: During iterative development of pure functions or isolated business logic where no database or network dependencies are required. Fast execution in milliseconds.

### 2. Integration / API Tests
- **Scope**: End-to-end HTTP request/response pipelines using Supertest against Express route handlers, controllers, and middlewares.
- **Examples**: User registration/login, submitting a ride request, role-based access denial on driver endpoints, passenger ride cancellation flow.
- **When Appropriate**: After updating or adding REST endpoints to verify HTTP status codes, payload structures, authentication headers, and error handling.

### 3. Database Tests
- **Scope**: Database schema validation, Prisma repository queries, constraint enforcement, and transactional integrity.
- **Examples**: Foreign key cascading rules, check constraints (e.g., non-negative poysha fares, valid status enums), unique index enforcement.
- **When Appropriate**: Whenever schema migrations, Prisma queries, or data persistence layer methods are introduced or altered.

### 4. Concurrency Tests
- **Scope**: Multi-threaded or asynchronous race condition verification on shared mutable state.
- **Examples**: Two passengers (e.g., Nusrat and Shirin) simultaneously requesting the final available seat in Jashim's 3-seat vehicle "Bullet".
- **When Appropriate**: Mandatory for any code touching seat reservation, pool joining, driver dispatch, or ride status changes. Must verify that only valid capacity is booked and overcapacity errors or rejections are clean.

### 5. Typecheck
- **Scope**: Static type verification across TypeScript codebase (`tsc --noEmit`).
- **Examples**: Ensuring DTO interfaces match controller payloads, Prisma-generated types align with service models, and no unsafe `any` leaks occur.
- **When Appropriate**: Must be run prior to committing any feature, bugfix, or refactor. Zero type errors allowed.

### 6. Lint
- **Scope**: Code quality, unused variables, styling consistency, and best-practice adherence.
- **When Appropriate**: Executed alongside typechecks to prevent lint warnings, forgotten console logs, or syntax formatting issues from entering the repository.

### 7. Build
- **Scope**: Production artifact compilation for both Next.js frontend (`next build`) and Express backend (`tsc -p tsconfig.build.json` or bundler).
- **When Appropriate**: Prior to releasing a milestone or running containerized Docker Compose end-to-end integration environments. Ensures no runtime missing-asset bugs exist.
