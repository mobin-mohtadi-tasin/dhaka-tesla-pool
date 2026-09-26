import { Prisma, Pool, RideStatus } from '@prisma/client';
import { HttpError } from './errors';
import { canTransition } from './domain';

export async function lockPool(tx: Prisma.TransactionClient, poolId: string): Promise<Pool> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM pools WHERE id = ${poolId}::uuid FOR UPDATE`;
  if (!rows.length) throw new HttpError(404, 'Pool not found');
  const pool = await tx.pool.findUnique({ where: { id: poolId } });
  if (!pool) throw new HttpError(404, 'Pool not found');
  return pool;
}

export async function lockVehicle(tx: Prisma.TransactionClient, vehicleId: string) {
  await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${vehicleId}::uuid FOR UPDATE`;
  return tx.vehicle.findUnique({ where: { id: vehicleId } });
}

export async function transitionRide(tx: Prisma.TransactionClient, rideId: string, to: RideStatus, reason?: string) {
  const ride = await tx.rideRequest.findUnique({ where: { id: rideId } });
  if (!ride) throw new HttpError(404, 'Ride not found');
  if (!canTransition(ride.status, to)) throw new HttpError(409, `Cannot transition ${ride.status} to ${to}`);
  await tx.rideRequest.update({ where: { id: rideId }, data: { status: to } });
  await tx.rideStatusHistory.create({ data: { rideRequestId: rideId, fromStatus: ride.status, toStatus: to, reason } });
}
