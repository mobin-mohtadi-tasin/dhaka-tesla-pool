import { PoolStatus, Prisma, RideStatus } from '@prisma/client';
import { db } from '../db';
import { canTransitionPool } from '../domain';
import { HttpError } from '../errors';
import { lockPool, transitionRide } from '../repositories';

const activeStatuses: PoolStatus[] = ['OPEN', 'FULL', 'IN_PROGRESS'];

export async function getVehicle(driverId: string) {
  const vehicle = await db.vehicle.findUnique({ where: { driverId } });
  if (!vehicle) throw new HttpError(404, 'No vehicle assigned to this driver');
  return vehicle;
}

export async function setAvailability(driverId: string, status: 'ONLINE' | 'OFFLINE') {
  const vehicle = await getVehicle(driverId);
  return db.vehicle.update({ where: { id: vehicle.id }, data: { driverStatus: status } });
}

export async function getActivePool(driverId: string) {
  const pool = await db.pool.findFirst({
    where: { vehicle: { driverId }, status: { in: activeStatuses } },
    include: { vehicle: true, memberships: { orderBy: { joinedAt: 'asc' }, include: { rideRequest: { include: { passenger: true } } } } },
  });
  if (!pool) return null;
  return {
    poolId: pool.id, status: pool.status, corridor: pool.corridorId, occupiedSeats: pool.occupiedSeats,
    capacity: pool.vehicle.capacity, vehicleName: pool.vehicle.name,
    passengers: pool.memberships.map((item) => ({ rideRequestId: item.rideRequestId, passengerName: item.rideRequest.passenger.fullName, pickupZone: item.rideRequest.pickupZone, dropoffZone: item.rideRequest.dropoffZone, seats: item.seatsAllocated, status: item.rideRequest.status })),
  };
}

const actions = {
  arrive: { fromPool: ['OPEN', 'FULL'] as PoolStatus[], fromRide: 'MATCHED' as RideStatus, toRide: 'DRIVER_ARRIVED' as RideStatus },
  start: { fromPool: ['OPEN', 'FULL'] as PoolStatus[], fromRide: 'DRIVER_ARRIVED' as RideStatus, toRide: 'STARTED' as RideStatus, toPool: 'IN_PROGRESS' as PoolStatus },
  complete: { fromPool: ['IN_PROGRESS'] as PoolStatus[], fromRide: 'STARTED' as RideStatus, toRide: 'COMPLETED' as RideStatus, toPool: 'COMPLETED' as PoolStatus },
};

export async function advancePool(driverId: string, poolId: string, action: keyof typeof actions) {
  const rule = actions[action];
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const pool = await lockPool(tx, poolId);
    const vehicle = await tx.vehicle.findUnique({ where: { id: pool.vehicleId } });
    if (!vehicle || vehicle.driverId !== driverId) throw new HttpError(404, 'Pool not found');
    if (!rule.fromPool.includes(pool.status)) throw new HttpError(409, 'Invalid pool state for this action');
    const members = await tx.poolMembership.findMany({ where: { poolId }, include: { rideRequest: true } });
    if (!members.length || members.some((member) => member.rideRequest.status !== rule.fromRide)) throw new HttpError(409, 'Passengers are not ready for this action');
    for (const member of members) await transitionRide(tx, member.rideRequestId, rule.toRide);
    const nextPool = 'toPool' in rule ? rule.toPool : undefined;
    if (nextPool) {
      if (!canTransitionPool(pool.status, nextPool)) throw new HttpError(409, 'Invalid pool transition');
      await tx.pool.update({ where: { id: poolId }, data: { status: nextPool, ...(action === 'start' ? { startedAt: new Date() } : {}), ...(action === 'complete' ? { completedAt: new Date() } : {}) } });
    }
    return { poolId, status: nextPool ?? pool.status, rideStatus: rule.toRide };
  }, { timeout: 15_000 });
}
