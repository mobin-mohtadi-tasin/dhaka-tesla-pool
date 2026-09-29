import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { db } from '../database/client';
import { HttpError } from '../shared/httpError';

export function publicUser(user: { id: string; phoneNumber: string; fullName: string; role: Role }) {
  return { id: user.id, phoneNumber: user.phoneNumber, fullName: user.fullName, role: user.role };
}

export async function register(input: { phoneNumber: string; password: string; fullName: string; role: Role; vehicle?: { name: string; licensePlate: string; capacity: number } }) {
  const existing = await db.user.findUnique({ where: { phoneNumber: input.phoneNumber } });
  if (existing) throw new HttpError(409, 'Phone number is already registered');
  const passwordHash = await bcrypt.hash(input.password, 12);
  return db.user.create({ data: {
    phoneNumber: input.phoneNumber, fullName: input.fullName, role: input.role, passwordHash,
    ...(input.role === 'DRIVER' && input.vehicle ? { vehicle: { create: input.vehicle } } : {}),
  } });
}

export async function login(phoneNumber: string, password: string) {
  const user = await db.user.findUnique({ where: { phoneNumber } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Invalid credentials');
  return user;
}

export async function getSessionUser(userId: string, role: Role) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== role) throw new HttpError(401, 'Session is no longer valid');
  return user;
}
