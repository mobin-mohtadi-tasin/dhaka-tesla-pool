import express, { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import { Prisma, Zone } from '@prisma/client';
import { ZodError, z } from 'zod';
import { requireAuth, requireRole, issueSession, sessionCookie } from './auth';
import { db } from './db';
import { fareFor, routeFor } from './domain';
import { HttpError } from './errors';
import { login, publicUser, register } from './services/authService';
import { cancelRide, createRide, getRide, listRides } from './services/rideService';
import { advancePool, getActivePool, getVehicle, listDriverHistory, setAvailability } from './services/driverService';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

const asyncRoute = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res)).catch(next);
};

const phone = z.string().regex(/^\+?[0-9]{10,15}$/);
const registration = z.object({
  phoneNumber: phone, password: z.string().min(10).max(128), fullName: z.string().trim().min(2).max(100),
  role: z.enum(['PASSENGER', 'DRIVER']).default('PASSENGER'),
  vehicle: z.object({ name: z.string().trim().min(2).max(60), licensePlate: z.string().trim().min(3).max(30), capacity: z.number().int().min(1).max(3) }).optional(),
}).refine((value) => value.role === 'DRIVER' ? !!value.vehicle : !value.vehicle, 'Vehicle details required only for drivers');
const loginInput = z.object({ phoneNumber: phone, password: z.string() });
const rideInput = z.object({ pickupZone: z.nativeEnum(Zone), dropoffZone: z.nativeEnum(Zone), seatsRequested: z.number().int().min(1).max(3).default(1) });
const idInput = z.string().uuid();

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/auth/register', asyncRoute(async (req, res) => {
  const input = registration.parse(req.body);
  const user = await register(input);
  sessionCookie(res, issueSession(user.id, user.role));
  res.status(201).json({ user: publicUser(user) });
}));

app.post('/auth/login', asyncRoute(async (req, res) => {
  const input = loginInput.parse(req.body);
  const user = await login(input.phoneNumber, input.password);
  sessionCookie(res, issueSession(user.id, user.role));
  res.json({ user: publicUser(user) });
}));

app.post('/auth/logout', (_req, res) => {
  res.clearCookie('dtp_session', { path: '/' });
  res.json({ ok: true });
});

app.get('/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const user = await db.user.findUnique({ where: { id: req.session!.userId } });
  if (!user || user.role !== req.session!.role) throw new HttpError(401, 'Session is no longer valid');
  res.json({ user: publicUser(user) });
}));

app.post('/rides/quote', requireRole('PASSENGER'), asyncRoute(async (req, res) => {
  const input = rideInput.parse(req.body);
  const route = routeFor(input.pickupZone, input.dropoffZone);
  if (!route) throw new HttpError(400, 'Unsupported route');
  res.json({ corridorId: route.corridor, fare: fareFor(input.pickupZone, input.dropoffZone, input.seatsRequested, false), potentialPooledFare: fareFor(input.pickupZone, input.dropoffZone, input.seatsRequested, true) });
}));

app.post('/rides', requireRole('PASSENGER'), asyncRoute(async (req, res) => {
  const input = rideInput.parse(req.body);
  const result = await createRide(req.session!.userId, input.pickupZone, input.dropoffZone, input.seatsRequested);
  res.status(201).json(result);
}));

app.get('/rides', requireRole('PASSENGER'), asyncRoute(async (req, res) => {
  res.json(await listRides(req.session!.userId));
}));

app.get('/rides/:id', requireRole('PASSENGER'), asyncRoute(async (req, res) => {
  res.json(await getRide(req.session!.userId, idInput.parse(req.params.id)));
}));

app.post('/rides/:id/cancel', requireRole('PASSENGER'), asyncRoute(async (req, res) => {
  const reason = z.object({ reason: z.string().trim().max(200).optional() }).parse(req.body ?? {}).reason;
  res.json(await cancelRide(req.session!.userId, idInput.parse(req.params.id), reason));
}));

app.get('/vehicles/me', requireRole('DRIVER'), asyncRoute(async (req, res) => {
  const vehicle = await getVehicle(req.session!.userId);
  res.json({ id: vehicle.id, name: vehicle.name, licensePlate: vehicle.licensePlate, capacity: vehicle.capacity, driverStatus: vehicle.driverStatus, isActive: vehicle.isActive });
}));

app.post('/vehicles/status', requireRole('DRIVER'), asyncRoute(async (req, res) => {
  const input = z.object({ driverStatus: z.enum(['ONLINE', 'OFFLINE']) }).parse(req.body);
  const vehicle = await setAvailability(req.session!.userId, input.driverStatus);
  res.json({ id: vehicle.id, driverStatus: vehicle.driverStatus, isActive: vehicle.isActive });
}));

app.get('/driver/rides', requireRole('DRIVER'), asyncRoute(async (req, res) => {
  res.json({ pool: await getActivePool(req.session!.userId) });
}));

app.get('/driver/history', requireRole('DRIVER'), asyncRoute(async (req, res) => {
  res.json(await listDriverHistory(req.session!.userId));
}));

for (const action of ['arrive', 'start', 'complete'] as const) {
  app.post(`/driver/rides/:id/${action}`, requireRole('DRIVER'), asyncRoute(async (req, res) => {
    res.json(await advancePool(req.session!.userId, idInput.parse(req.params.id), action));
  }));
}

app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  if (error instanceof ZodError) return res.status(400).json({ error: 'Invalid request', details: error.flatten() });
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: 'Duplicate record' });
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
