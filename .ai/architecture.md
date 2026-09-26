# Architecture Specification: Dhaka Tesla Pool

This document defines the system architecture, component boundaries, layer responsibilities, and data flow for the Dhaka Tesla Pool MVP.

---

## Technology Stack

- **Frontend**: Next.js (App/Pages Router) with TypeScript
- **Backend**: Node.js with Express and TypeScript
- **Database**: PostgreSQL
- **ORM / Query Builder**: Prisma
- **API Protocol**: RESTful JSON over HTTP
- **Testing**: Vitest + Supertest (unit, integration, concurrency)
- **Infrastructure**: Docker Compose (orchestrating app and database containers)

---

## Architectural Layers

```
+-----------------------------------------------------------+
|                      Browser / Client                     |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
|              Next.js Frontend (Presentation)              |
+-----------------------------------------------------------+
                             |  HTTP / REST (JSON)
                             v
+-----------------------------------------------------------+
|                   Express REST API Layer                  |
|    - CORS, JSON Parser, Auth Middleware, Error Handler   |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
|                     Controllers Layer                     |
|    - HTTP Request Handling, DTO Validation, Status Codes  |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
|              Services / Use Cases Layer                   |
|    - Domain Workflows, State Transitions, Business Rules  |
|    - Pooling Engine & Fare Calculation                    |
|    - OWNS TRANSACTION BOUNDARY (prisma.$transaction)      |
+-----------------------------------------------------------+
                             | (passes tx / transactional client)
                             v
+-----------------------------------------------------------+
|             Repositories / Prisma Client Layer            |
|    - Pure Data Access & Query Execution                   |
|    - Executes queries inside provided transaction (tx)    |
|    - Never initiates or demarcates transactions           |
+-----------------------------------------------------------+
                             |
                             v
+-----------------------------------------------------------+
|                   PostgreSQL Database                     |
|    - ACID Transactions, Row Locking, Constraints, Enums   |
+-----------------------------------------------------------+
```

---

## Component Responsibilities

### 1. Frontend (Next.js + TypeScript)
- Presents user interfaces for Passenger (requesting rides, viewing active pool status, reviewing fare breakdowns) and Driver (toggling availability, viewing assigned pool manifest, updating trip stages).
- Captures user input, provides immediate client-side UI feedback, and handles auth token storage.
- **Critical Invariant**: Frontend validation exists solely to improve user experience. **Business rules, security checks, and capacity assertions must NEVER depend on frontend validation.**

### 2. API Routes & Controllers
- Expose clear, resource-oriented REST endpoints (`/auth`, `/rides`, `/driver/rides`, `/pools`).
- Inspect HTTP headers, extract parameters, and validate incoming payload formats (e.g., using schema validation like Zod).
- Map domain service results or exceptions to standard HTTP response codes (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`, `500 Internal Error`).
- Keep controllers thin: contain no business logic, no direct SQL/Prisma calls, and no transaction control.

### 3. Authentication & Authorization
- Issues and verifies stateless authentication tokens (e.g., JWT or secure session cookies).
- Implements role-based middleware (`requireAuth`, `requireRole('PASSENGER')`, `requireRole('DRIVER')`).
- Enforces strict tenancy and ownership: passengers may only access their own rides and fares; drivers may only view and modify trips assigned to their vehicle.

### 4. Service Layer (Use Cases & Transaction Boundary Ownership)
- Encapsulates all domain workflows, business use cases, and state transitions.
- **Sole Owner of Transaction Boundaries**: The service orchestrates atomic multi-step mutations via `prisma.$transaction(...)`. It controls when transactions begin, what business assertions are checked inside the transaction, and when to commit or abort.
- **Example Transaction Flow (Seat Allocation)**:
  ```
  joinPool() (Service Layer)
      │
      └── prisma.$transaction(async (tx) => {
               │
               ├── poolRepo.lockAndGet(tx, poolId)        // 1. Lock pool row
               ├── verify capacity invariant              // 2. Domain logic check: occupied < capacity
               ├── membershipRepo.create(tx, data)        // 3. Create pool membership
               ├── poolRepo.incrementOccupiedSeats(tx)    // 4. Update occupied seat count & status
               └── commit                                 // 5. Commit atomic transaction
          })
  ```
- Coordinates between user profiles, ride requests, pools, and status updates.

### 5. Pooling Engine
- Evaluates candidate pools for incoming passenger ride requests based on deterministic criteria:
  - Matching pickup zone and drop-off zone corridor.
  - Active vehicle availability and heading compatibility.
  - Remaining available seats in the vehicle.
- Handles atomic seat allocation, guaranteeing that multiple simultaneous booking requests do not exceed the vehicle's capacity limit (e.g., 3 seats in "Bullet").

### 6. Fare Calculation
- Calculates independent fares for each passenger based on zone-to-zone distance matrix, corridor base rates, and applicable dynamic pooling discounts.
- Operates strictly in integer poysha (1 BDT = 100 poysha) to prevent floating-point rounding errors.

### 7. State Machine
- Strictly enforces valid transitions across ride and pool lifecycles:
  - **Ride Request**:
    ```
    REQUESTED → MATCHED → DRIVER_ARRIVED → STARTED → COMPLETED
    Cancellations:
    REQUESTED → CANCELLED
    MATCHED   → CANCELLED (frees reserved seat in pool)
    ```
  - **Cancellation Rules**:
    - Cancellations permitted ONLY while in `REQUESTED` or `MATCHED` status.
    - Cancellations strictly FORBIDDEN once the ride reaches `DRIVER_ARRIVED`, `STARTED`, or `COMPLETED`.
  - **Pool Lifecycle**:
    `OPEN` ⇄ `FULL` → `IN_PROGRESS` → `COMPLETED` (or `CANCELLED`).
    - `OPEN → FULL`: Triggered when capacity is reached (`occupied_seats == vehicle.capacity`).
    - `FULL → OPEN`: **Legal and mandatory**. Triggered when a pre-start cancellation frees a seat (`occupied_seats < vehicle.capacity`), reopening the pool for new matches.
    - `OPEN → IN_PROGRESS` & `FULL → IN_PROGRESS`: Driver can start the trip either with full or partial passenger occupancy.
- Prevents invalid or out-of-order transitions (e.g., a ride cannot transition from `REQUESTED` directly to `STARTED`, nor can a cancelled ride be boarded).

### 8. Repositories & Prisma (Data Access)
- Typesafe database abstraction mapping relational tables to TypeScript domain models.
- **Strictly Data Access Only**: Repositories MUST NEVER initiate or demarcate transactions independently. They accept an optional or mandatory transactional client (`tx: Prisma.TransactionClient`) parameter to execute queries within the service-owned transaction.
- Repositories encapsulate raw SQL operations (such as `SELECT ... FOR UPDATE` raw row locking) and Prisma CRUD queries, keeping low-level query mechanics isolated from business logic.

### 9. Database (PostgreSQL)
- **The ultimate source of truth** for all persistent state, seat allocations, and concurrency integrity.
- Enforces relational constraints (foreign keys, non-null fields, check constraints, unique constraints, and enums).
- Provides row-level locking (`SELECT ... FOR UPDATE`) during seat allocation to serialize concurrent bookings on the same pool or vehicle.
