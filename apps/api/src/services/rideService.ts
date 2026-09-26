import { Prisma, Zone } from '@prisma/client';
import { db } from '../db';
import { canTransitionPool, fareFor, routeFor } from '../domain';
import { HttpError } from '../errors';
import { lockPool, lockVehicle, transitionRide } from '../repositories';

type Tx = Prisma.TransactionClient;

async function repricePool(tx: Tx, poolId: string) {
  const members = await tx.poolMembership.findMany({ where: { poolId }, include: { rideRequest: true } });
  const pooled = members.length > 1;
  for (const member of members) {
    const ride = member.rideRequest;
    await tx.fare.update({ where: { rideRequestId: ride.id }, data: fareFor(ride.pickupZone, ride.dropoffZone, member.seatsAllocated, pooled) });
  }
}

async function tryJoin(tx: Tx, poolId: string, rideId: string, corridorId: string, seats: number) {
  const pool = await lockPool(tx, poolId);
  const vehicle = await tx.vehicle.findUnique({ where: { id: pool.vehicleId } });
  if (pool.status !== 'OPEN' || pool.corridorId !== corridorId || !vehicle?.isActive || vehicle.driverStatus !== 'ONLINE') return false;
  if (pool.occupiedSeats + seats > vehicle.capacity) return false;
  await tx.poolMembership.create({ data: { poolId, rideRequestId: rideId, seatsAllocated: seats } });
  const occupiedSeats = pool.occupiedSeats + seats;
  await tx.pool.update({ where: { id: poolId }, data: { occupiedSeats, status: occupiedSeats === vehicle.capacity ? 'FULL' : 'OPEN' } });
  await transitionRide(tx, rideId, 'MATCHED');
  await repricePool(tx, poolId);
  return true;
}

export async function createRide(passengerId: string, pickupZone: Zone, dropoffZone: Zone, seatsRequested: number) {
  const route = routeFor(pickupZone, dropoffZone);
  if (!route) throw new HttpError(400, 'Unsupported route');
  const rideId = await db.$transaction(async (tx) => {
    const ride = await tx.rideRequest.create({ data: { passengerId, pickupZone, dropoffZone, seatsRequested, status: 'REQUESTED' } });
    await tx.rideStatusHistory.create({ data: { rideRequestId: ride.id, toStatus: 'REQUESTED' } });
    await tx.fare.create({ data: { rideRequestId: ride.id, ...fareFor(pickupZone, dropoffZone, seatsRequested, false) } });

    const pools = await tx.pool.findMany({
      where: { status: 'OPEN', corridorId: route.corridor, vehicle: { isActive: true, driverStatus: 'ONLINE', capacity: { gte: seatsRequested } } },
      orderBy: [{ createdAt: 'asc' }, { vehicleId: 'asc' }],
    });
    for (const pool of pools) if (await tryJoin(tx, pool.id, ride.id, route.corridor, seatsRequested)) return ride.id;

    const vehicles = await tx.vehicle.findMany({
      where: { isActive: true, driverStatus: 'ONLINE', capacity: { gte: seatsRequested } },
      orderBy: { id: 'asc' },
    });
    for (const candidate of vehicles) {
      const vehicle = await lockVehicle(tx, candidate.id);
      if (!vehicle?.isActive || vehicle.driverStatus !== 'ONLINE' || vehicle.capacity < seatsRequested) continue;
      const active = await tx.pool.findFirst({ where: { vehicleId: vehicle.id, status: { in: ['OPEN', 'FULL', 'IN_PROGRESS'] } } });
      if (active) {
        if (await tryJoin(tx, active.id, ride.id, route.corridor, seatsRequested)) return ride.id;
        continue;
      }
      const pool = await tx.pool.create({ data: { vehicleId: vehicle.id, corridorId: route.corridor } });
      await tryJoin(tx, pool.id, ride.id, route.corridor, seatsRequested);
      return ride.id;
    }
    return ride.id;
  }, { timeout: 15_000 });
  return getRide(passengerId, rideId);
}

export async function getRide(passengerId: string, rideId: string) {
  const ride = await db.rideRequest.findFirst({
    where: { id: rideId, passengerId },
    include: { fare: true, history: { orderBy: { createdAt: 'asc' } }, membership: { include: { pool: { include: { vehicle: { include: { driver: true } } } } } } },
  });
  if (!ride) throw new HttpError(404, 'Ride not found');
  const pool = ride.membership?.pool;
  return {
    rideRequestId: ride.id, status: ride.status, pickupZone: ride.pickupZone, dropoffZone: ride.dropoffZone,
    seatsRequested: ride.seatsRequested, createdAt: ride.createdAt,
    pool: pool ? { id: pool.id, status: pool.status, occupiedSeats: pool.occupiedSeats, capacity: pool.vehicle.capacity } : null,
    driver: pool ? { fullName: pool.vehicle.driver.fullName, vehicleName: pool.vehicle.name, licensePlate: pool.vehicle.licensePlate } : null,
    fare: ride.fare ? { baseFarePoysha: ride.fare.baseFarePoysha, distanceFarePoysha: ride.fare.distanceFarePoysha, discountPoysha: ride.fare.discountPoysha, totalFarePoysha: ride.fare.totalFarePoysha, currency: 'BDT', paymentMethod: ride.fare.paymentMethod, paymentStatus: ride.fare.paymentStatus } : null,
    history: ride.history.map((entry) => ({ fromStatus: entry.fromStatus, toStatus: entry.toStatus, reason: entry.reason, createdAt: entry.createdAt })),
  };
}

export async function listRides(passengerId: string) {
  const rides = await db.rideRequest.findMany({ where: { passengerId }, orderBy: { createdAt: 'desc' }, include: { fare: true } });
  return { rides: rides.map((ride) => ({ rideRequestId: ride.id, pickupZone: ride.pickupZone, dropoffZone: ride.dropoffZone, status: ride.status, totalFarePoysha: ride.fare?.totalFarePoysha, createdAt: ride.createdAt })), total: rides.length };
}

export async function cancelRide(passengerId: string, rideId: string, reason?: string) {
  await db.$transaction(async (tx) => {
    const membership = await tx.poolMembership.findUnique({ where: { rideRequestId: rideId } });
    const pool = membership ? await lockPool(tx, membership.poolId) : null;
    const ride = await tx.rideRequest.findFirst({ where: { id: rideId, passengerId } });
    if (!ride) throw new HttpError(404, 'Ride not found');
    if (ride.status !== 'REQUESTED' && ride.status !== 'MATCHED') throw new HttpError(409, 'Ride can no longer be cancelled');
    if (ride.status === 'MATCHED') {
      if (!membership || !pool || (pool.status !== 'OPEN' && pool.status !== 'FULL')) throw new HttpError(409, 'Pool is no longer cancellable');
      await tx.poolMembership.delete({ where: { rideRequestId: rideId } });
      const occupiedSeats = pool.occupiedSeats - membership.seatsAllocated;
      if (occupiedSeats < 0) throw new Error('Pool seat counter is inconsistent');
      const status = occupiedSeats === 0 ? 'CANCELLED' : 'OPEN';
      if (status !== pool.status && !canTransitionPool(pool.status, status)) throw new Error('Invalid pool transition');
      await tx.pool.update({ where: { id: pool.id }, data: { occupiedSeats, status } });
      await repricePool(tx, pool.id);
    }
    await transitionRide(tx, rideId, 'CANCELLED', reason ?? 'CANCELLED_BY_PASSENGER');
  }, { timeout: 15_000 });
  return getRide(passengerId, rideId);
}
