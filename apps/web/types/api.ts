export type User = { id: string; fullName: string; phoneNumber: string; role: 'PASSENGER' | 'DRIVER' };
export type Fare = { baseFarePoysha: number; distanceFarePoysha: number; discountPoysha: number; totalFarePoysha: number; currency: string; paymentMethod: string; paymentStatus: string };
export type Ride = {
  rideRequestId: string; status: string; pickupZone: string; dropoffZone: string; seatsRequested: number; createdAt: string;
  pool: { id: string; status: string; occupiedSeats: number; capacity: number } | null;
  driver: { fullName: string; vehicleName: string; licensePlate: string } | null;
  fare: Fare | null;
  history: { fromStatus: string | null; toStatus: string; reason: string | null; createdAt: string }[];
};
export type Manifest = { poolId: string; status: string; corridor: string; occupiedSeats: number; capacity: number; vehicleName: string; passengers: { rideRequestId: string; passengerName: string; pickupZone: string; dropoffZone: string; seats: number; status: string }[] };
export type PastPool = { poolId: string; status: string; corridor: string; occupiedSeats: number; createdAt: string; completedAt: string | null; passengers: { name: string; pickupZone: string; dropoffZone: string }[] };
