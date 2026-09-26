import { randomBytes, randomInt } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

const testUrl = process.env.TEST_DATABASE_URL;
const dedicatedTestDatabase = testUrl && /_test$/.test(new URL(testUrl).pathname);

describe.skipIf(!dedicatedTestDatabase)('pool transactions against PostgreSQL', () => {
  let app: Express;
  let db: PrismaClient;
  const password = randomBytes(16).toString('hex');
  const phones = String(randomInt(1000000, 9999999));

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    process.env.SESSION_SECRET = randomBytes(32).toString('hex');
    ({ default: app } = await import('../src/app'));
    ({ db } = await import('../src/db'));
    await db.vehicle.updateMany({ data: { driverStatus: 'OFFLINE' } });
  });

  async function register(index: number, fullName: string, role: 'PASSENGER' | 'DRIVER' = 'PASSENGER') {
    const response = await request(app).post('/auth/register').send({
      phoneNumber: `+88017${phones}${index}`, fullName, password, role,
      ...(role === 'DRIVER' ? { vehicle: { name: 'Bullet Test', licensePlate: `TEST-${phones}`, capacity: 3 } } : {}),
    });
    expect(response.status).toBe(201);
    return response.headers['set-cookie'][0] as string;
  }

  it('allocates one last seat, protects ownership, and blocks late cancellation', async () => {
    const driver = await register(0, 'Jashim Test', 'DRIVER');
    const nusrat = await register(1, 'Nusrat Test');
    const rafiq = await register(2, 'Rafiq Test');
    const shirin = await register(3, 'Shirin Test');
    const ashik = await register(4, 'Ashik Test');
    expect((await request(app).post('/vehicles/status').set('Cookie', driver).send({ driverStatus: 'ONLINE' })).status).toBe(200);

    const first = await request(app).post('/rides').set('Cookie', nusrat).send({ pickupZone: 'BANANI', dropoffZone: 'MOHAKHALI', seatsRequested: 1 });
    const second = await request(app).post('/rides').set('Cookie', rafiq).send({ pickupZone: 'BANANI', dropoffZone: 'GULSHAN_1', seatsRequested: 1 });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.pool.id).toBe(first.body.pool.id);
    const repriced = await request(app).get(`/rides/${first.body.rideRequestId}`).set('Cookie', nusrat);
    expect(repriced.body.fare.totalFarePoysha).toBe(2000);
    expect(second.body.fare.totalFarePoysha).toBe(2160);

    const [third, fourth] = await Promise.all([
      request(app).post('/rides').set('Cookie', shirin).send({ pickupZone: 'BANANI', dropoffZone: 'MOHAKHALI', seatsRequested: 1 }),
      request(app).post('/rides').set('Cookie', ashik).send({ pickupZone: 'BANANI', dropoffZone: 'MOHAKHALI', seatsRequested: 1 }),
    ]);
    expect([third.status, fourth.status]).toEqual([201, 201]);
    expect([third.body.status, fourth.body.status].sort()).toEqual(['MATCHED', 'REQUESTED']);
    const pool = await db.pool.findUniqueOrThrow({ where: { id: first.body.pool.id }, include: { memberships: true } });
    expect(pool.occupiedSeats).toBe(3);
    expect(pool.memberships.reduce((total, member) => total + member.seatsAllocated, 0)).toBe(3);
    expect((await request(app).get(`/rides/${first.body.rideRequestId}`).set('Cookie', shirin)).status).toBe(404);

    expect((await request(app).post(`/driver/rides/${pool.id}/arrive`).set('Cookie', driver).send({})).status).toBe(200);
    expect((await request(app).post(`/rides/${first.body.rideRequestId}/cancel`).set('Cookie', nusrat).send({})).status).toBe(409);
    expect((await request(app).post(`/driver/rides/${pool.id}/start`).set('Cookie', driver).send({})).status).toBe(200);
    expect((await request(app).post(`/driver/rides/${pool.id}/complete`).set('Cookie', driver).send({})).status).toBe(200);
    const history = await request(app).get('/driver/history').set('Cookie', driver);
    expect(history.status).toBe(200);
    expect(history.body.pools[0].poolId).toBe(pool.id);
  }, 30_000);
});
