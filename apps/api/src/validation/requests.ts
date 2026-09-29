import { Zone } from '@prisma/client';
import { z } from 'zod';

const phone = z.string().regex(/^\+?[0-9]{10,15}$/);
export const registration = z.object({
  phoneNumber: phone, password: z.string().min(10).max(128), fullName: z.string().trim().min(2).max(100),
  role: z.enum(['PASSENGER', 'DRIVER']).default('PASSENGER'),
  vehicle: z.object({ name: z.string().trim().min(2).max(60), licensePlate: z.string().trim().min(3).max(30), capacity: z.number().int().min(1).max(3) }).optional(),
}).refine((value) => value.role === 'DRIVER' ? !!value.vehicle : !value.vehicle, 'Vehicle details required only for drivers');
export const loginInput = z.object({ phoneNumber: phone, password: z.string() });
export const rideInput = z.object({ pickupZone: z.nativeEnum(Zone), dropoffZone: z.nativeEnum(Zone), seatsRequested: z.number().int().min(1).max(3).default(1) });
export const idInput = z.string().uuid();
export const cancellationInput = z.object({ reason: z.string().trim().max(200).optional() });
export const availabilityInput = z.object({ driverStatus: z.enum(['ONLINE', 'OFFLINE']) });
