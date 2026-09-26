# REST API: implemented MVP contract

The browser calls `/api/*` on the Next.js origin. Next.js rewrites requests to the Express API, which exposes the paths below without the `/api` prefix. Authentication uses a signed, HTTP only `dtp_session` cookie. All requests and responses are JSON except `GET /health` (also JSON). API errors have an `error` string and an appropriate HTTP status.

## Public

- `GET /health` returns `{ "status": "ok" }`.
- `POST /auth/register` accepts `phoneNumber`, `password`, `fullName`, and `role` (`PASSENGER` by default). Drivers must also supply `vehicle: { name, licensePlate, capacity }`. Capacity is an integer from 1 to 3 and cannot later change. Returns `201` and a public `user`; sets the session cookie. Passwords require at least 10 characters.
- `POST /auth/login` accepts `phoneNumber` and `password`. Returns `{ user }`; sets the session cookie.
- `POST /auth/logout` clears the session cookie.
- `GET /auth/me` returns `{ user }` for the signed in user.

## Passenger

All passenger routes require the `PASSENGER` role. Invalid or unsupported route pairs return `400`.

- `POST /rides/quote` accepts `{ pickupZone, dropoffZone, seatsRequested }`. Returns the corridor, solo `fare`, and `potentialPooledFare`. This is an estimate; the persisted fare can change when members join or cancel.
- `POST /rides` accepts the same route fields. Returns `201` with the created ride, status, pool and vehicle details if matched, fare breakdown, and status history. If no compatible vehicle has capacity, status remains `REQUESTED`.
- `GET /rides` returns `{ rides, total }` for the signed in passenger only.
- `GET /rides/:id` returns that passenger's ride, fare, pool summary, and status history. Another passenger's ID returns `404`.
- `POST /rides/:id/cancel` accepts optional `{ reason }`. `REQUESTED` and `MATCHED` rides can be cancelled. A matched cancellation removes the membership, decrements occupancy, and reopens a formerly full pool. If the last member cancels, the empty pool becomes `CANCELLED`. Later cancellation returns `409`.

Example ride request:

```json
{ "pickupZone": "BANANI", "dropoffZone": "MOHAKHALI", "seatsRequested": 1 }
```

Supported route pairs and corridor compatibility are listed in [pooling.md](pooling.md).

## Driver

All driver routes require the `DRIVER` role. A driver can access only the vehicle and pool assigned to that account.

- `GET /vehicles/me` returns the driver's vehicle and availability.
- `POST /vehicles/status` accepts `{ "driverStatus": "ONLINE" }` or `OFFLINE`.
- `GET /driver/rides` returns `{ pool: null }` or `{ pool: { poolId, status, corridor, occupiedSeats, capacity, vehicleName, passengers } }` for the current active pool. The manifest contains names, route zones, seats, and ride statuses; it does not expose passenger fares.
- `GET /driver/history` returns the driver's 20 most recent completed or cancelled pools, including passengers still associated with each pool.
- `POST /driver/rides/:id/arrive` transitions all `MATCHED` rides to `DRIVER_ARRIVED`.
- `POST /driver/rides/:id/start` requires every member to be `DRIVER_ARRIVED`; transitions the pool to `IN_PROGRESS` and rides to `STARTED`.
- `POST /driver/rides/:id/complete` requires `IN_PROGRESS`; transitions the pool and member rides to `COMPLETED`.

Pool actions return `404` for a pool assigned to another driver and `409` for an invalid state transition. These actions are serialized by a pool row lock in a service owned PostgreSQL transaction.
