# Database Design Draft: Dhaka Tesla Pool

This document defines the conceptual and logical database design for Dhaka Tesla Pool. It details proposed entities, attributes, relationships, constraints, and invariants.

> **Note**: This is a database design specification. No Prisma schema or raw SQL DDL is generated in this document.

---

## Core Entities & Relationships

### 1. `users`
- **Purpose**: Stores account details, credentials, and roles for all platform participants (Passengers and Drivers).
- **Important Fields**:
  - `id`: Unique identifier (UUID).
  - `phone_number`: Unique phone number used for login / identification.
  - `full_name`: User's display name.
  - `role`: Role discriminator enum (`PASSENGER`, `DRIVER`, `ADMIN`).
  - `password_hash`: Securely hashed authentication credential.
  - `created_at`, `updated_at`: Timestamps.
- **Primary Key**: `id`
- **Foreign Keys**: None.
- **Important Constraints**:
  - `phone_number` must be unique (`UNIQUE(phone_number)`).
  - `role` must be a valid enum value.
- **Important Indexes**:
  - Unique index on `phone_number`.
  - Index on `role`.

---

### 2. `vehicles`
- **Purpose**: Represents the physical battery-powered rickshaw ("Tesla") operating on transit corridors.
- **Important Fields**:
  - `id`: Unique identifier (UUID).
  - `driver_id`: Foreign key referencing the assigned driver in `users`.
  - `name`: Display name or identifier (e.g., "Bullet").
  - `license_plate`: Registration or municipal tag number.
  - `capacity`: Maximum passenger seat capacity (e.g., 3 seats).
    Capacity is immutable after vehicle creation; the initial migration enforces this with a trigger.
  - `driver_status`: Enum availability state (`OFFLINE`, `ONLINE`). Default: `OFFLINE`.
  - `is_active`: Boolean flag indicating if the vehicle is in active service/maintenance.
  - `created_at`, `updated_at`: Timestamps.
- **Primary Key**: `id`
- **Foreign Keys**:
  - `driver_id` → `users(id)`.
- **Important Constraints**:
  - `capacity > 0` (strictly positive integer, typically fixed at 3 for standard electric rickshaws).
  - `UNIQUE(driver_id)`: **MVP Simplification Assumption**. Enforces a strict 1-to-1 mapping between an active driver and their vehicle (e.g., driver Jashim operates vehicle "Bullet"). In a multi-shift production system, a driver could operate multiple vehicles over time or vehicles could be shared across shifts via an assignment table. For the MVP, a 1-to-1 unique constraint is deliberately chosen to streamline vehicle lookups and dispatch without extra junction abstractions.
  - `UNIQUE(license_plate)`.
- **Important Indexes**:
  - Unique index on `driver_id`.
  - Index on `(driver_status, is_active)` to rapidly find online, active vehicles ready for pool dispatch.

---

### 3. `pools`
- **Purpose**: Represents an active or completed trip instance for a vehicle, grouping multiple passenger ride requests along a shared corridor.
- **Important Fields**:
  - `id`: Unique identifier (UUID).
  - `vehicle_id`: Foreign key referencing the assigned vehicle.
  - `corridor_id`: Identifier of the transit corridor (e.g., "BANANI_MOHAKHALI").
  - `status`: Enum lifecycle status (`OPEN`, `FULL`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`).
  - `occupied_seats`: Denormalized integer counter of currently allocated seats in this pool.
  - `started_at`, `completed_at`: Timestamps for trip start and end.
  - `created_at`, `updated_at`: Timestamps.
- **Design Decision on `occupied_seats`**:
  - *Option Considered (Normalized aggregate)*: Compute occupancy dynamically via `SUM(pool_memberships.seats_allocated)` while locking the vehicle row (`SELECT ... FOR UPDATE FROM vehicles`). This eliminates duplicate representation of seat counts, but requires aggregate joins on every candidate matching query.
  - *Chosen Design (Atomic Denormalized Counter)*: Maintain `pools.occupied_seats` directly on the pool row and update it atomically inside the exact same database transaction that creates or removes a `pool_membership`. This enables ultra-fast indexed matching queries (`WHERE status = 'OPEN' AND (capacity - occupied_seats) >= requested`) and provides a clean, easily demonstrable row-locking concurrency boundary (`SELECT ... FOR UPDATE FROM pools`).
- **Primary Key**: `id`
- **Foreign Keys**:
  - `vehicle_id` → `vehicles(id)`.
- **Important Constraints**:
  - `CHECK (occupied_seats >= 0)`: Standard single-table PostgreSQL check constraint ensuring seat counts never drop below zero.
  - `occupied_seats <= vehicle.capacity`: Because `vehicle.capacity` is stored on the foreign `vehicles` table, standard PostgreSQL table-level `CHECK` constraints cannot evaluate this cross-table condition. Instead, this invariant is strictly enforced by the Service Layer's seat-allocation transaction under an exclusive row lock (`SELECT ... FOR UPDATE FROM pools`), aborting if `(occupied_seats + requested) > capacity`.
- **Important Indexes**:
  - Index on `(status, corridor_id, occupied_seats)` to rapidly locate candidate pools with open capacity during matching.
  - Index on `vehicle_id`.
  - Partial unique index on `vehicle_id` while status is `OPEN`, `FULL`, or `IN_PROGRESS`, enforcing one active pool per vehicle.

---

### 4. `ride_requests`
- **Purpose**: Captures an individual passenger's request to travel from an origin zone to a destination zone.
- **Important Fields**:
  - `id`: Unique identifier (UUID).
  - `passenger_id`: Foreign key referencing the passenger in `users`.
  - `pickup_zone`: Zone enum (`BANANI`, `MOHAKHALI`, `GULSHAN_1`, `GULSHAN_2`, `MIRPUR_10`, `UTTARA`).
  - `dropoff_zone`: Zone enum (`BANANI`, `MOHAKHALI`, `GULSHAN_1`, `GULSHAN_2`, `MIRPUR_10`, `UTTARA`).
  - `status`: Enum lifecycle status (`REQUESTED`, `MATCHED`, `DRIVER_ARRIVED`, `STARTED`, `COMPLETED`, `CANCELLED`).
  - `seats_requested`: Number of seats requested (default: 1).
  - `created_at`, `updated_at`: Timestamps.
- **Primary Key**: `id`
- **Foreign Keys**:
  - `passenger_id` → `users(id)`.
- **Important Constraints**:
  - `pickup_zone <> dropoff_zone` (cannot book a ride to the exact same zone).
  - `seats_requested > 0`.
- **Important Indexes**:
  - Index on `(status, pickup_zone, dropoff_zone)` for pending match lookups.
  - Index on `passenger_id` for passenger ride history.

---

### 5. `pool_memberships`
- **Purpose**: Junction record associating an individual `ride_request` with a specific `pool`.
- **Important Fields**:
  - `id`: Unique identifier (UUID).
  - `pool_id`: Foreign key referencing the target pool.
  - `ride_request_id`: Foreign key referencing the associated ride request.
  - `seats_allocated`: Number of seats booked by this member (default: 1).
  - `joined_at`: Timestamp when the member was added to the pool.
- **Primary Key**: `id`
- **Foreign Keys**:
  - `pool_id` → `pools(id)`.
  - `ride_request_id` → `ride_requests(id)`.
- **Important Constraints**:
  - `UNIQUE(ride_request_id)`: A single ride request can belong to at most one pool at any given time.
  - `seats_allocated > 0`.
- **Important Indexes**:
  - Unique index on `ride_request_id`.
  - Composite index on `(pool_id, joined_at)`.

---

### 6. `ride_status_history`
- **Purpose**: Provides an immutable audit log of all status transitions for every ride request, enabling lifecycle tracking and debugging.
- **Important Fields**:
  - `id`: Unique identifier (UUID).
  - `ride_request_id`: Foreign key referencing the ride request.
  - `from_status`: Preceding status (nullable for initial creation).
  - `to_status`: New status transitioned into.
  - `reason`: Optional text description or reason code (e.g., "CANCELLED_BY_PASSENGER").
  - `created_at`: Timestamp of transition.
- **Primary Key**: `id`
- **Foreign Keys**:
  - `ride_request_id` → `ride_requests(id)` (cascade delete or preserve).
- **Important Constraints**:
  - `to_status` must be a valid ride request status.
- **Important Indexes**:
  - Index on `(ride_request_id, created_at)`.

---

### 7. `fares`
- **Purpose**: Stores the computed financial breakdown and settlement status for each passenger's ride request.
- **Important Fields**:
  - `id`: Unique identifier (UUID).
  - `ride_request_id`: Foreign key referencing the associated ride request.
  - `base_fare_poysha`: Base boarding fee in integer poysha.
  - `distance_fare_poysha`: Zone distance fee in integer poysha.
  - `discount_poysha`: Pooling discount deducted in integer poysha.
  - `total_fare_poysha`: Final payable fare in integer poysha (`base + distance - discount`).
  - `currency`: Default "BDT".
  - `payment_method`: Enum (`CASH`). A simulated wallet is deferred.
  - `payment_status`: Enum (`UNPAID`, `PAID`). Default: `UNPAID`.
  - `paid_at`: Optional timestamp when fare was marked paid.
  - `created_at`: Timestamp of calculation.
- **Primary Key**: `id`
- **Foreign Keys**:
  - `ride_request_id` → `ride_requests(id)`.
- **Important Constraints**:
  - `UNIQUE(ride_request_id)`: Exactly one fare calculation per ride request.
  - `total_fare_poysha >= 0`: Fare can never be negative.
  - `total_fare_poysha = base_fare_poysha + distance_fare_poysha - discount_poysha`.
- **Important Indexes**:
  - Unique index on `ride_request_id`.

---

### 8. `payments` Entity Decision (Omitted for MVP)

- **Decision**: A separate `payments` table is **OMITTED** for the MVP.
- **Rationale**:
  - Real payment gateways (bKash, Nagad, credit cards) are strictly forbidden by project constraints.
  - Settlements are purely simulated via either direct driver cash collection (`CASH`) or mock digital wallet (`TESLAPAY`).
  - Tracking `payment_method` (`CASH`) and `payment_status` (`UNPAID`, `PAID`) directly on `fares` keeps the schema ready for later simulated settlement without a premature multi-table ledger.
  - A separate `payments` / ledger entity will only be introduced if mock wallet balance top-ups, partial payments, or user wallet balance transfers are explicitly added in future phases.

---

## Critical Database Invariants

1. **Fixed Vehicle Capacity**: Every vehicle has a fixed integer capacity defined at the vehicle record level (e.g., 3 seats for "Bullet").
2. **Never Exceed Capacity**: Under no circumstances may `occupied_seats` in any `pool` exceed the referenced vehicle's capacity:
   $$\text{occupied\_seats} \le \text{vehicle.capacity}$$
   Because `vehicle.capacity` is a column on the `vehicles` table, a standard PostgreSQL `CHECK` constraint cannot evaluate this cross-table condition. This invariant is enforced strictly by the transactional seat-allocation logic within an explicit row lock (`SELECT ... FOR UPDATE FROM pools`).
3. **Single Vehicle & Driver Association (MVP Scope)**: Each pool is tied to exactly one vehicle and driver. For the MVP, a driver is bound 1-to-1 to a single vehicle (`UNIQUE(driver_id)`), simplifying dispatch lookups without multi-vehicle shift tracking.
4. **Single Active Membership**: A ride request can only belong to one active pool membership at a time (`UNIQUE(ride_request_id)` on `pool_memberships`).
5. **Strict Data Isolation**: Row-level tenancy guarantees that a passenger can query only their own `ride_requests`, `fares`, and `ride_status_history`.
6. **Immutable State Transitions**: Status transitions must adhere to valid state machine progressions. Intermediate states cannot be skipped.
7. **Integer Monetary Precision**: All monetary values (`base_fare_poysha`, `distance_fare_poysha`, `discount_poysha`, `total_fare_poysha`, `amount_poysha`) must be stored as integers representing poysha (1 BDT = 100 poysha). Floating-point numeric types are banned.
8. **Counter Synchronization Invariant**:
   $$\text{pool.occupied\_seats} = \sum_{\text{membership} \in \text{pool}} \text{membership.seats\_allocated}$$
   Because `occupied_seats` is a denormalized counter, it must NEVER be modified in isolation. Its value must be updated strictly within the exact same database transaction that inserts or deletes a `pool_memberships` record.
