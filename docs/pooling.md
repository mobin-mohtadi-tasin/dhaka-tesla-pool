# Pooling Engine Specification: Dhaka Tesla Pool

This document defines the deterministic seat-sharing and ride-pooling algorithm, concurrency controls, seat allocation invariants, and lifecycle interactions for the Dhaka Tesla Pool MVP.

> **Note**: This document provides the design specification. No application implementation code is included.

---

## 1. Zone Model & Corridor Graph

Rather than relying on heavy, non-deterministic GIS map APIs (Google Maps, OSRM), the platform models Dhaka transit routes as a discrete, deterministic zone graph with fixed corridors.

### Predefined Zones
The MVP defines discrete transit nodes representing central commercial and residential hubs:
- `BANANI`: Banani Transit Hub (Kamal Ataturk Ave / Chairman Bari)
- `MOHAKHALI`: Mohakhali Transit Node (Flyover intersection / Wireless Gate)
- `GULSHAN_1`: Gulshan 1 Circle
- `GULSHAN_2`: Gulshan 2 Circle
- `MIRPUR_10`: Peripheral reference node (non-compatible corridor test)
- `UTTARA`: Peripheral reference node (non-compatible corridor test)

### Predefined Corridors & Route Mapping
Every valid `(pickup_zone, dropoff_zone)` pair maps deterministically to a canonical corridor:

| Route (`pickup → dropoff`) | Assigned Corridor ID | Travel Direction / Arterial Spine |
| :--- | :--- | :--- |
| `BANANI → MOHAKHALI` | `CORRIDOR_BANANI_SOUTH` | Southbound along Airport Rd / Mohakhali spine |
| `BANANI → GULSHAN_1` | `CORRIDOR_BANANI_SOUTH` | Southbound via Banani-Gulshan link |
| `BANANI → GULSHAN_2` | `CORRIDOR_BANANI_EAST` | Eastbound along Kemal Ataturk Ave |
| `GULSHAN_2 → GULSHAN_1`| `CORRIDOR_GULSHAN_SOUTH` | Southbound along Gulshan Ave |
| `MOHAKHALI → BANANI` | `CORRIDOR_BANANI_NORTH` | Northbound return spine |
| `MIRPUR_10 → UTTARA` | `CORRIDOR_MIRPUR_UTTARA` | Disjoint western-northern corridor |

---

## 2. Deterministic Route Compatibility Rule Engine

Two passenger requests are poolable if and only if their routes are classified as **COMPATIBLE**.

### Route Compatibility Rules:
1. **Identical Corridor Match**: Two routes mapping to the same `corridor_id` and directional heading can share a vehicle pool.
2. **Sequential Drop-off Feasibility**: On `CORRIDOR_BANANI_SOUTH`, a trip starting at `BANANI` drops off first at `GULSHAN_1` (or `MOHAKHALI` depending on corridor lane) without reverse backtracking.
3. **Strict Incompatibility**:
   - Routes in opposite travel directions on the same physical road (e.g., Northbound vs Southbound) are **INCOMPATIBLE**.
   - Routes belonging to disjoint transit corridors (e.g., Banani corridor vs Mirpur-Uttara) are **INCOMPATIBLE**.

### Deterministic Compatibility Matrix:

| Route A | Route B | Compatible? | Evaluator Rationale |
| :--- | :--- | :---: | :--- |
| `BANANI → MOHAKHALI` (Nusrat) | `BANANI → GULSHAN_1` (Rafiq) | **YES** | Shared pickup hub (`BANANI`) and shared southbound corridor heading (`CORRIDOR_BANANI_SOUTH`). |
| `BANANI → MOHAKHALI` (Nusrat) | `BANANI → MOHAKHALI` (Shirin) | **YES** | Identical origin, destination, and corridor. |
| `BANANI → MOHAKHALI` (Nusrat) | `MOHAKHALI → BANANI` | **NO** | Opposite directional heading (Southbound vs Northbound); reverse travel forbidden. |
| `BANANI → MOHAKHALI` (Nusrat) | `MIRPUR_10 → UTTARA` | **NO** | Disjoint corridors (`CORRIDOR_BANANI_SOUTH` vs `CORRIDOR_MIRPUR_UTTARA`). |
| `BANANI → GULSHAN_2` | `BANANI → MOHAKHALI` | **NO** | Divergent directional vectors (Eastbound into Gulshan 2 vs Southbound toward Mohakhali). |

### Deterministic Rule Engine Function
```typescript
function areRoutesCompatible(routeA: Route, routeB: Route): boolean {
  const corridorA = mapRouteToCorridor(routeA.pickupZone, routeA.dropoffZone);
  const corridorB = mapRouteToCorridor(routeB.pickupZone, routeB.dropoffZone);
  return corridorA !== null && corridorA === corridorB;
}
```

---

## 3. Step-by-Step Matching Algorithm

When a passenger submits a ride request:
1. **Corridor Identification**:
   - Determine `request.corridor_id = mapRouteToCorridor(request.pickupZone, request.dropoffZone)`.
   - If route is invalid or unsupported, reject with `400 Bad Request`.

2. **Locate Candidate Pools**:
   - Query PostgreSQL for candidate pools matching ALL of the following criteria:
     - `pool.status == 'OPEN'`
     - `pool.corridor_id == request.corridor_id`
     - `pool.vehicle.is_active == true`
     - `pool.vehicle.driver_status == 'ONLINE'`
     - `(pool.vehicle.capacity - pool.occupied_seats) >= request.seats_requested`

3. **Deterministic Selection Order**:
   - If multiple candidate pools qualify, select the pool with the oldest creation timestamp (`ORDER BY created_at ASC`).
   - If timestamps tie, break ties deterministically by vehicle ID (`ORDER BY vehicle_id ASC`).

4. **New Pool Creation Fallback**:
   - If no candidate pool has available seats, but an active vehicle with `is_active == true` and `driver_status == 'ONLINE'` exists with no active pool, instantiate a new `OPEN` pool assigned to that vehicle with `corridor_id = request.corridor_id`.
   - If no online vehicle or pool is available, the request remains in `REQUESTED` status awaiting an available vehicle or timeout.

---

## 4. Seat Allocation & Denormalized Counter Architecture

- Every vehicle has a fixed, immutable capacity attribute:
  $$\text{Capacity}(\text{Bullet}) = 3$$
- **Counter Architecture Decision**:
  - `pools.occupied_seats` is deliberately maintained as an **atomic denormalized counter**, rather than calculating `SUM(pool_memberships.seats_allocated)` dynamically on every matching query.
  - While dynamic aggregation eliminates duplicate representation, it introduces expensive table joins during fast corridor lookups and requires locking the vehicle row across all candidate checks.
  - Using a transactionally maintained counter on `pools` enables instant indexed filtering (`(capacity - occupied_seats) >= requested`) and provides a clear, defensible row-locking target (`SELECT ... FOR UPDATE FROM pools`) that is simple to demonstrate and test.
- **Seat Allocation Transition**:
  $$\text{New Occupied Seats} = \text{Current Occupied Seats} + \text{seats\_requested}$$
- If $\text{New Occupied Seats} == \text{Vehicle Capacity}$, the pool status automatically transitions from `OPEN` to `FULL`.
- If a passenger cancels their booking while the pool is in `OPEN` or `FULL` status, the allocated seats are subtracted from `occupied_seats` inside the cancellation transaction, and a `FULL` pool reopens to `OPEN`.
- **Synchronization Invariant**:
  $$\text{pool.occupied\_seats} \equiv \sum_{\text{membership} \in \text{pool}} \text{membership.seats\_allocated}$$
  The counter and membership records must ALWAYS be updated in the same atomic transaction.

---

## 5. Pool Membership

- The relationship between a `ride_request` and a `pool` is mediated by the `pool_memberships` entity.
- A single ride request can be bound to at most **one** pool membership (`UNIQUE(ride_request_id)`).
- Multiple passengers (e.g., Nusrat occupying seat 1, Rafiq occupying seat 2) each hold an independent `pool_membership` record linked to Jashim's active pool on "Bullet".

---

## 6. Independent Fare Calculation

- Each passenger in a pool receives an **independently calculated fare**.
- Fares are not arbitrarily split in equal fractions. Instead, each passenger's fare is computed using their own journey attributes:
  $$\text{Fare}_{\text{passenger}} = \text{BaseFare}_{\text{corridor}} + \text{DistanceFare}(\text{pickup}, \text{dropoff}) - \text{PoolingDiscount}$$
- **Pooling Discount**: A fixed discount (e.g., 20% savings) is deducted from the standard single-passenger fare when the ride is pooled.
- All monetary operations are calculated and stored in **integer poysha** (1 BDT = 100 poysha) to eliminate floating-point rounding errors.

---

## 7. Ride & Pool Lifecycle Interaction

The pooling engine directly drives the ride and pool state machines:

```
[Ride Request Created] ──> REQUESTED ──(Passenger Cancels)──> CANCELLED
                              │
               (Match Found & Seat Claimed)
                              │
                              v
                           MATCHED   ──(Passenger Cancels)──> CANCELLED (Seat Freed)
                              │
                    (Driver Marks Arrived)
                              │
                              v
                        DRIVER_ARRIVED (Cancellation Blocked)
                              │
                    (Driver Starts Trip)
                              │
                              v
                           STARTED
                              │
                    (Driver Drops Off)
                              │
                              v
                          COMPLETED
```

- **Cancellation Rules**:
  - Passengers can cancel ONLY when in `REQUESTED` or `MATCHED` status.
  - When a `MATCHED` passenger cancels, their `pool_memberships` record is removed and `pools.occupied_seats` is decremented in the same transaction. If the pool was `FULL`, it transitions back to `OPEN`.
  - Once the ride transitions to `DRIVER_ARRIVED`, passenger cancellation is strictly forbidden.
### Pool State Lifecycle

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
```

- **Pool Lifecycle Rules**:
  - `OPEN → FULL`: Triggered inside the seat allocation transaction when `occupied_seats` reaches vehicle capacity (e.g., 3/3).
  - `FULL → OPEN`: **Legal and mandatory**. If a passenger cancels their booking while `MATCHED` prior to trip start, freeing a seat (`occupied_seats < capacity`), the pool status reverts from `FULL` to `OPEN` to accept new matching requests.
  - `OPEN / FULL → IN_PROGRESS`: The driver can start the trip when the pool is completely full (3/3) or at scheduled departure with open seats (e.g., 1/3 or 2/3).
  - When all members reach `COMPLETED`, the pool status transitions to `COMPLETED`, freeing the vehicle to accept or create a new pool.

---

## 8. Concurrency & The Last-Seat Race Condition

### The Edge Case Scenario:
1. Driver Jashim's vehicle "Bullet" has total capacity = 3.
2. Seats 1 and 2 are currently occupied by passengers Nusrat and Rafiq.
3. Exactly **1 seat remains**.
4. Two passengers—Passenger Shirin and another concurrent user—both submit ride requests for the Banani corridor at the exact same millisecond.

### Failure Mode (Without Concurrency Control):
A naive application reading `occupied_seats` would see `2 < 3` for both requests, grant reservations to both, resulting in 4 passengers booked in a 3-seat vehicle—violating a fundamental system invariant.

### Safe Concurrency Solution:
- The seat reservation logic executes inside a **PostgreSQL interactive transaction** owned by the **Service Layer** (`prisma.$transaction`) with explicit row-level locking:
  ```sql
  -- Acquire exclusive lock on the target pool record
  SELECT id, vehicle_id, occupied_seats, status
  FROM pools
  WHERE id = $poolId
  FOR UPDATE;
  ```
- **Service Transaction Flow**:
  ```
  joinPool() (Service Layer)
      │
      └── prisma.$transaction(async (tx) => {
               ├── poolRepo.lockAndGet(tx, poolId)        // 1. Lock pool row
               ├── verify capacity invariant              // 2. Check: occupied + requested <= capacity
               ├── membershipRepo.create(tx, data)        // 3. Create pool membership
               ├── poolRepo.incrementOccupiedSeats(tx)    // 4. Update occupied seat count & status
               ├── rideRequestRepo.updateStatus(tx)       // 5. Update ride request status to MATCHED
               └── commit                                 // 6. Commit atomic transaction
          })
  ```
- **Step-by-Step Mechanics**:
  1. Service initiates interactive transaction via `prisma.$transaction`.
  2. Repository acquires row lock with `FOR UPDATE` using the provided `tx` client, blocking concurrent bookings on this specific pool row.
  3. Service queries vehicle capacity and verifies that $(\text{occupied\_seats} + \text{requested\_seats}) \le \text{capacity}$.
  4. If capacity is available:
     - Insert record into `pool_memberships` using `tx`.
     - Update `pools` incrementing `occupied_seats` (and transition status to `FULL` if limit reached) using `tx`.
     - Update `ride_requests` status to `MATCHED` using `tx`.
     - Commit transaction (releasing row lock).
  5. If capacity is exceeded:
     - Abort/rollback transaction.
     - Return capacity conflict / rejection to the concurrent passenger, preserving the 3/3 seat invariant.

---

## 9. Invariants

The pooling engine must strictly maintain these invariants under all operating conditions:

1. **Capacity Limit**: $\text{occupied\_seats} \le \text{vehicle.capacity}$ at all times.
2. **No Phantom Bookings**: A seat cannot be allocated without an associated `pool_memberships` record and a `ride_requests` record in `MATCHED`, `DRIVER_ARRIVED`, or `STARTED` status.
3. **Single Active Pool per Vehicle**: A vehicle cannot have more than one pool in `OPEN` or `IN_PROGRESS` status concurrently.
4. **Unique Membership**: A ride request cannot belong to multiple pools simultaneously.
5. **Deterministic Results**: Given an identical sequence of inputs, the matching engine must produce the identical assignment outcome.
