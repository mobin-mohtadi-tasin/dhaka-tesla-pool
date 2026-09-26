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

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status})`);
  return result as T;
}

export function bdt(poysha: number) { return `৳${(poysha / 100).toFixed(2)}`; }
export function label(value: string) { return value.replaceAll('_', ' '); }
