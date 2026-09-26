# Project: Dhaka Tesla Pool

## Problem

In Dhaka, battery-powered three-wheeled rickshaws—locally and colloquially referred to as "Teslas"—serve as the primary feeder transit connecting dense residential and commercial neighborhoods. Commuters along high-demand corridors frequently travel identical routes during peak hours, yet vehicles are often hailed individually or filled through chaotic manual street negotiations.

**Dhaka Tesla Pool** is an MVP web platform for seat-sharing and dynamic ride-pooling specifically tailored to these electric three-wheelers. The platform coordinates passenger ride requests along defined transit corridors, dynamically pools commuters heading in the same direction, optimizes vehicle seat occupancy, and delivers predictable, split-fare pricing.

---

## Seed Personas

To validate system mechanics, edge cases, and deterministic matching rules, the following seed personas are established:

### Driver
- **Name**: Jashim
- **Role**: Registered electric rickshaw operator
- **Vehicle**: "Bullet"
- **Seat Capacity**: 3 passenger seats (strictly fixed)
- **Status**: Available on the Banani hub corridor

### Passenger 1
- **Name**: Nusrat
- **Route**: Banani → Mohakhali
- **Role**: First passenger to request a ride on the corridor; establishes the initial active pool.

### Passenger 2
- **Name**: Rafiq
- **Route**: Banani → Gulshan 1
- **Role**: Second passenger requesting a ride heading in a compatible direction; matched into the active pool with Jashim and Nusrat, filling seat 2 of 3.

### Passenger 3 (Concurrency Edge Case)
- **Name**: Shirin
- **Role**: Concurrent passenger requesting a seat on the same corridor when only 1 seat remains in Jashim's vehicle "Bullet". Used to test and verify that last-seat allocation handles race conditions correctly without overbooking.

---

## Actors

1. **Passenger**: A registered customer who submits ride requests, views fare quotes, monitors ride status, receives match confirmations, and cancels pending/matched requests when allowed.
2. **Driver**: A registered vehicle operator who toggles availability, receives assigned pool batches, marks arrivals, initiates trips, and completes passenger drop-offs.
3. **Vehicle**: The physical transport asset with fixed attributes (license/identifier, maximum capacity of 3 seats, assigned driver).
4. **Ride/Pool Engine**: The deterministic backend engine responsible for matching ride requests into pools, validating capacity invariants, orchestrating state transitions, and calculating per-passenger fares.

---

## Core Requirements

- **Authentication & Profiles**: Role-based access control distinguishing Passengers and Drivers. Secure session/token issuance.
- **Ride Requests**: Passengers specify predefined pickup and drop-off zones along Dhaka transit corridors.
- **Deterministic Pooling & Matching**: The engine checks active pools and available vehicles on compatible routes, respecting vehicle capacity.
- **Driver Lifecycle**: Drivers view current assigned pools and execute sequential trip states: `MATCHED` → `DRIVER_ARRIVED` → `STARTED` → `COMPLETED`.
- **Seat Allocation & Concurrency**: Atomic seat reservations in PostgreSQL ensuring that vehicle capacity (e.g., 3 seats) is never exceeded under concurrent booking attempts.
- **Dynamic Fare Model**: Independent per-passenger fare calculation based on corridor base rates, distance zones, and pooling discounts, calculated and stored in integer poysha.
- **Ride History & Status Tracking**: Detailed lifecycle logs for passengers and drivers with complete timestamped state history.
- **Data Authorization**: Passengers can only view their own rides and fares; drivers can only view assigned pools and active passenger manifests.

---

## Constraints

- **No Paid Infrastructure**: Must run entirely on open-source, local tooling without requiring paid third-party cloud services.
- **No Real Payment Gateway**: Simulated or ledger-based fare accounting only; no bKash/Nagad/SSLCommerz live API integration.
- **No Heavy Map APIs**: No dependency on Google Maps, Mapbox, or expensive geolocation billing APIs; routing and matching utilize discrete, predefined Dhaka transit zones.
- **Fixed Vehicle Capacity**: Standard battery rickshaws have a rigid capacity limit (3 seats); overcapacity is an unrecoverable system failure.
- **Deterministic Predefined Zones**: Route matching relies on a fixed zone graph (e.g., Banani, Mohakhali, Gulshan 1, Gulshan 2).
- **Docker Compose**: Entire backend, database, and frontend environment must launch cleanly via Docker Compose.
- **Public Repository & Clean Git History**: Developed transparently with small, atomic, and well-documented commits.

---

## Non-goals

- Real-time GPS turn-by-turn navigation or real-time road traffic recalculation.
- Real-world monetary payment processing or banking integration.
- Complex multi-modal transit graph routing across greater Bangladesh.
- Microservices, event streaming platforms (Kafka/RabbitMQ), or Kubernetes clustering for the MVP.
- Dynamic surge pricing algorithms dependent on external weather or traffic telematics.
