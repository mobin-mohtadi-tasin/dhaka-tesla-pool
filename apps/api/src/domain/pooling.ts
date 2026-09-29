import { PoolStatus, RideStatus, Zone } from '@prisma/client';

const routes: Record<string, { corridor: string; distanceFarePoysha: number }> = {
  BANANI_MOHAKHALI: { corridor: 'CORRIDOR_BANANI_SOUTH', distanceFarePoysha: 1000 },
  BANANI_GULSHAN_1: { corridor: 'CORRIDOR_BANANI_SOUTH', distanceFarePoysha: 1200 },
  BANANI_GULSHAN_2: { corridor: 'CORRIDOR_BANANI_EAST', distanceFarePoysha: 1400 },
  GULSHAN_2_GULSHAN_1: { corridor: 'CORRIDOR_GULSHAN_SOUTH', distanceFarePoysha: 700 },
  MOHAKHALI_BANANI: { corridor: 'CORRIDOR_BANANI_NORTH', distanceFarePoysha: 1000 },
  MIRPUR_10_UTTARA: { corridor: 'CORRIDOR_MIRPUR_UTTARA', distanceFarePoysha: 1800 },
};

export function routeFor(pickup: Zone, dropoff: Zone) {
  return routes[`${pickup}_${dropoff}`] ?? null;
}

export function fareFor(pickup: Zone, dropoff: Zone, seats: number, pooled: boolean) {
  const route = routeFor(pickup, dropoff);
  if (!route) throw new Error('Unsupported route');
  const baseFarePoysha = 1500 * seats;
  const distanceFarePoysha = route.distanceFarePoysha * seats;
  const subtotal = baseFarePoysha + distanceFarePoysha;
  const discountPoysha = pooled ? Math.floor(subtotal / 5) : 0;
  return { baseFarePoysha, distanceFarePoysha, discountPoysha, totalFarePoysha: subtotal - discountPoysha };
}

const transitions: Record<RideStatus, RideStatus[]> = {
  REQUESTED: ['MATCHED', 'CANCELLED'],
  MATCHED: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['STARTED'],
  STARTED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: RideStatus, to: RideStatus) {
  return transitions[from].includes(to);
}

const poolTransitions: Record<PoolStatus, PoolStatus[]> = {
  OPEN: ['FULL', 'IN_PROGRESS', 'CANCELLED'],
  FULL: ['OPEN', 'IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransitionPool(from: PoolStatus, to: PoolStatus) {
  return poolTransitions[from].includes(to);
}
