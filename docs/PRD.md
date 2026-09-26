# Dhaka Tesla Pool — Product Requirements Document (PRD)

---

## 1. Overview

**Dhaka Tesla Pool** is an MVP web application for seat-sharing and dynamic ride-pooling for battery-powered three-wheel rickshaws (locally nicknamed "Teslas") in Dhaka, Bangladesh. The system enables passengers traveling along common transit corridors to pool rides into a single vehicle, maximizing driver occupancy and delivering affordable, split-fare transportation while strictly preventing overcapacity.

---

## 2. Seed Personas

To test and demonstrate the system deterministically, three seed passenger personas and one seed driver persona are specified:

- **Driver: Jashim**
  - Operates vehicle named **"Bullet"**.
  - Vehicle capacity: Exactly **3 passenger seats**.
  - Base location: Banani transit corridor hub.
- **Passenger: Nusrat**
  - Route: **Banani → Mohakhali**
  - First passenger requesting a ride along this corridor.
- **Passenger: Rafiq**
  - Route: **Banani → Gulshan 1**
  - Second passenger whose route is compatible with the Banani corridor heading.
- **Passenger: Shirin**
  - Concurrency test persona.
  - Used to simulate the race condition where multiple passengers attempt to book the final available seat in Jashim's vehicle simultaneously.

---

## 3. Actors

The system defines four primary actors:

1. **Passenger**: Initiates ride requests, views fare quotes, monitors ride status, receives match notifications, and can cancel prior to pickup.
2. **Driver**: Registers vehicle, sets availability, receives assigned pool passenger manifests, marks arrival, initiates trips, and completes passenger drop-offs.
3. **Vehicle**: The physical asset with an assigned driver and a strictly fixed passenger seat capacity (e.g., 3 seats).
4. **Pool Engine**: The automated system service that matches compatible ride requests, assigns seats, enforces concurrency rules, and manages lifecycle transitions.

---

## 4. Passenger Requirements

- **Registration & Authentication**: Passengers can register, log in, and securely manage their profile.
- **Ride Request Creation**: Passengers select a pickup zone and a drop-off zone from predefined Dhaka zones.
- **Fare Quote**: System calculates and presents an estimated fare in integer poysha before booking confirmation.
- **Real-Time Status & Tracking**: Passenger can view the current state of their ride (`REQUESTED`, `MATCHED`, `DRIVER_ARRIVED`, `STARTED`, `COMPLETED`, or `CANCELLED`).
- **Cancellation**: Passenger may cancel a request while in `REQUESTED` or `MATCHED` state; cancellation frees up the reserved seat in the pool. Cancellation is strictly prohibited once the ride reaches `DRIVER_ARRIVED`, `STARTED`, or `COMPLETED`.
- **Ride History**: Passenger can view a list of past completed or cancelled rides with full timestamped status histories and fare receipts.

---

## 5. Driver / Vehicle Requirements

- **Driver Authentication**: Secure login and profile management for drivers.
- **Vehicle Registration & Assignment**: Drivers are linked to their vehicle with a defined capacity (e.g., 3 seats for "Bullet").
- **Availability Toggle**: Driver can toggle availability status (`driver_status`: `ONLINE` / `OFFLINE`). The matching engine assigns candidate pools exclusively to vehicles with `driver_status == ONLINE`.
- **Trip Manifest**: Driver can view current assigned pool details, including passenger list, pickup points, and drop-off destinations in sequence.
- **Trip Lifecycle Actions**: Driver updates trip stages sequentially:
  - Mark arrival at pickup location (`DRIVER_ARRIVED`).
  - Start the trip once passengers board (`STARTED`).
  - Mark completion when all passengers reach their destinations (`COMPLETED`).

---

## 6. Pool Engine

- **Compatibility Evaluation**: Evaluates incoming ride requests against active pools based on:
  - Common corridor / compatible directional heading.
  - Pickup and drop-off zones along the transit trajectory.
  - Remaining unallocated seat capacity in the vehicle.
- **Deterministic Matching**: Evaluates candidates systematically to produce repeatable, verifiable match results without non-deterministic heuristics.
- **Dynamic Grouping**: Automatically groups compatible passengers into a single vehicle pool up to the maximum capacity limit.
- **Rejection / Waiting**: If no compatible pool or vehicle has open seats, the request remains in `REQUESTED` status awaiting an available vehicle or timeout.

---

## 7. Ride State Machine

All ride requests and pool instances follow strictly governed state machines:

### Ride Request State Machine

```
REQUESTED
    │
    ▼
 MATCHED
    │
    ▼
DRIVER_ARRIVED
    │
    ▼
 STARTED
    │
    ▼
COMPLETED

Cancellations:
REQUESTED ──> CANCELLED
 MATCHED   ──> CANCELLED (frees reserved seat)
```

#### State Definitions:
- `REQUESTED`: Request created by passenger; awaiting matching.
- `MATCHED`: Successfully matched and assigned to a vehicle pool with a reserved seat.
- `DRIVER_ARRIVED`: Driver has arrived at the designated pickup zone.
- `STARTED`: Passengers have boarded and the driver has commenced the trip along the corridor.
- `COMPLETED`: Passenger has arrived at destination and dropped off; ride finalized.
- `CANCELLED`: Terminal state reached when cancelled by passenger prior to pickup.

#### Explicit Cancellation Rules:
1. **Permitted States**: A passenger can ONLY cancel when the ride request is in `REQUESTED` or `MATCHED` status.
2. **Prohibited States**: Cancellation is rejected if the ride is in `DRIVER_ARRIVED`, `STARTED`, or `COMPLETED`.
3. **Seat De-allocation**: When a `MATCHED` request is cancelled, the associated `pool_memberships` record is removed, `pools.occupied_seats` is decremented inside the same atomic transaction, and if the pool was `FULL`, it reopens to `OPEN`.
4. **Terminal State**: `CANCELLED` is immutable; cancelled rides cannot be transitioned to any other state.

### Pool State Machine

```
         ┌─────────────────────────┐
         │          OPEN           │◄────────┐
         │ (accepting passengers)  │         │
         └───────────┬─────────────┘         │
                     │                       │
           (occupied == capacity)   (pre-start cancellation:
                     │               occupied < capacity)
                     ▼                       │
         ┌─────────────────────────┐         │
         │          FULL           │─────────┘
         │  (capacity reached)     │
         └───────────┬─────────────┘
                     │
          (driver starts trip:
            from OPEN or FULL)
                     │
                     ▼
         ┌─────────────────────────┐
         │       IN_PROGRESS       │
         │    (trip underway)      │
         └───────────┬─────────────┘
                     │
          (driver completes trip)
                     │
                     ▼
         ┌─────────────────────────┐
         │        COMPLETED        │
         │      (pool closed)      │
         └─────────────────────────┘

Cancellation:
OPEN / FULL ──(driver cancellation / vehicle breakdown)──> CANCELLED
```

#### Pool State Rules:
1. `OPEN → FULL`: Triggered inside the seat allocation transaction when `occupied_seats` reaches `vehicle.capacity` (e.g., 3/3).
2. `FULL → OPEN`: **Legal and mandatory**. If a passenger cancels their booking while in `MATCHED` status prior to trip start, freeing capacity (`occupied_seats < vehicle.capacity`), the pool automatically reopens to `OPEN` to accept subsequent passenger requests.
3. `OPEN → IN_PROGRESS` & `FULL → IN_PROGRESS`: The driver can start the trip either when full (3/3 seats) or upon scheduled departure with partial capacity (e.g., 2/3 seats occupied).
4. `IN_PROGRESS → COMPLETED`: Triggered when the driver successfully completes drop-offs for all passengers.
5. `OPEN / FULL → CANCELLED`: Triggered if the vehicle experiences mechanical failure or the driver cancels before departure.

---

## 8. Geography & Route Compatibility Engine

The system uses a deterministic zone graph and fixed corridor mappings rather than external GIS map engines:

### Predefined Zones
- **`BANANI`**: Banani Transit Hub (Chairman Bari / Kemal Ataturk Ave)
- **`MOHAKHALI`**: Mohakhali Node (Wireless Gate / Flyover artery)
- **`GULSHAN_1`**: Gulshan 1 Commercial Circle
- **`GULSHAN_2`**: Gulshan 2 Diplomatic Circle
- **`MIRPUR_10`**: Western peripheral node (disjoint corridor test)
- **`UTTARA`**: Northern peripheral node (disjoint corridor test)

### Corridor Classification & Compatibility
- **`CORRIDOR_BANANI_SOUTH`**: Serves southbound transit from Banani hub toward Mohakhali and Gulshan 1.
  - `BANANI → MOHAKHALI` and `BANANI → GULSHAN_1` are **COMPATIBLE** (can share Jashim's vehicle "Bullet").
  - Identical routes (e.g. Nusrat + Shirin both requesting `BANANI → MOHAKHALI`) are **COMPATIBLE**.
- **Incompatible Route Rules**:
  - Reverse routes (e.g., `MOHAKHALI → BANANI` vs `BANANI → MOHAKHALI`) are **INCOMPATIBLE** (opposite traffic flow).
  - Cross-town disjoint routes (e.g., `MIRPUR_10 → UTTARA` vs `BANANI → MOHAKHALI`) are **INCOMPATIBLE**.
  - Divergent trajectories (e.g., `BANANI → GULSHAN_2` Eastbound vs `BANANI → MOHAKHALI` Southbound) are **INCOMPATIBLE**.

---

## 9. Fare Model

- **Currency Unit**: Integer **poysha** (1 BDT = 100 poysha). Floating-point values are strictly forbidden.
- **Fare Breakdown**:
  - `Base Fare`: Fixed corridor boarding charge.
  - `Distance Fare`: Zone-to-zone fixed unit rate.
  - `Pooling Discount`: Percentage discount applied when a ride is successfully shared with other passengers.
- **Independent Fares**: Each passenger receives an independently calculated fare reflecting their specific pickup and drop-off zones.

---

## 10. Payment Model

- **Simulated Settlement**: Real payment gateways (bKash/Nagad/cards) are strictly forbidden by MVP constraints.
- **Payment Method**:
  - `CASH`: Passenger settles in cash directly with the driver upon arrival/completion.
- **Payment Status**: Tracked directly on the `fares` record (`payment_status`: `UNPAID`, `PAID`) with an optional `paid_at` timestamp.
- **No Complex Ledger Table**: A separate `payments` database table is omitted for the MVP to avoid premature complexity. Fare calculations and settlement statuses remain self-contained within `fares`. Cash settlement confirmation is deferred.

---

## 11. Technical Requirements

- **Frontend**: Next.js + TypeScript.
- **Backend**: Node.js + Express + TypeScript.
- **Database**: PostgreSQL with Prisma ORM.
- **API Architecture**: RESTful JSON over HTTP.
- **Containerization**: Docker Compose running PostgreSQL, backend API, and frontend.
- **Environment Management**: Configuration managed through `.env` files with a clean `.env.example` checked into the repository.

---

## 12. Git Workflow

- **Repository**: Public GitHub repository.
- **Commit Granularity**: Meaningful, small atomic commits reflecting logical increments.
- **Commit Messages**: Conventional, structured commit messages describing rationale.
- **No Secrets**: Never commit sensitive environment files, secrets, or credentials.

---

## 13. Testing Requirements

- **Framework**: Vitest (or Jest) with Supertest.
- **Coverage Areas**:
  - Unit tests for fare calculations and zone matching logic.
  - Integration tests for REST endpoints and state machine transitions.
  - Authentication and authorization boundaries.
  - Concurrency tests for seat booking limits.

---

## 14. Concurrency Requirements

- **Zero Overcapacity Invariant**: A 3-seat vehicle must NEVER accommodate 4 passenger bookings under any circumstance.
- **Last-Seat Race Condition**: When 1 seat remains in a pool, concurrent booking attempts (e.g., Shirin vs. another user) must be serialized using database transactions and row-level locking (`SELECT ... FOR UPDATE`). Exactly one request must succeed; the other must receive an out-of-capacity rejection or wait for the next vehicle.

---

## 15. AI Usage

- AI coding agents may be utilized for planning, coding, and testing.
- All AI work must be guided by repository instructions (`AGENTS.md`) and verified with automated test suites, typechecks, and linters.

---

## 16. Scale Bonus

- Architectural readiness for scaling to multiple corridors, vehicles, and zones.
- Clean separation of concerns (Layered Architecture: Controller → Service → Repository) to permit future modular extraction or worker process delegation without rewriting core logic.

---

## 17. Deliverables

1. Full source code for backend API and frontend interfaces.
2. Complete documentation suite (PRD, Architecture, Decisions, Database Design, Pooling Specification, API Map).
3. Docker Compose configuration file for local reproducibility.
4. Comprehensive test suite demonstrating business logic, state transitions, and concurrency safety.

---

## 18. Anti-patterns

- Relying on client-side frontend validation for security, pricing, or seat availability.
- Storing currency values as floating-point numbers (`Float` / `Double`).
- In-memory seat counters or un-locked reads susceptible to race conditions.
- Introducing heavy third-party dependencies (Kafka, Redis, Google Maps API, Kubernetes) for an MVP.
- Bypassing relational database constraints or hardcoding credentials.
