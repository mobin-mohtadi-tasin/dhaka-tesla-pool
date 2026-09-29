import { randomBytes, randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { issueSession } from '../src/middleware/auth';

beforeAll(() => {
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
});

describe('HTTP contracts across API layers', () => {
  it('keeps health and unknown endpoints accessible with their original statuses', async () => {
    expect((await request(app).get('/health')).body).toEqual({ status: 'ok' });
    expect((await request(app).get('/rides/unknown/path')).status).toBe(404);
  });

  it('requires authentication on every passenger and driver endpoint', async () => {
    const endpoints = [
      ['get', '/auth/me'], ['post', '/rides/quote'], ['post', '/rides'],
      ['get', '/rides'], ['get', `/rides/${randomUUID()}`],
      ['post', `/rides/${randomUUID()}/cancel`], ['get', '/vehicles/me'],
      ['post', '/vehicles/status'], ['get', '/driver/rides'], ['get', '/driver/history'],
      ...['arrive', 'start', 'complete'].map((action) => ['post', `/driver/rides/${randomUUID()}/${action}`]),
    ];
    for (const [method, path] of endpoints) {
      const response = method === 'get' ? await request(app).get(path) : await request(app).post(path).send({});
      expect(response.status, `${method} ${path}`).toBe(401);
    }
  });

  it('enforces role boundaries before invoking services', async () => {
    const passenger = `dtp_session=${issueSession(randomUUID(), 'PASSENGER')}`;
    const driver = `dtp_session=${issueSession(randomUUID(), 'DRIVER')}`;
    expect((await request(app).get('/vehicles/me').set('Cookie', passenger)).status).toBe(403);
    expect((await request(app).get('/driver/rides').set('Cookie', passenger)).status).toBe(403);
    expect((await request(app).get('/rides').set('Cookie', driver)).status).toBe(403);
  });

  it('preserves quote responses and rejects invalid or unsupported routes', async () => {
    const cookie = `dtp_session=${issueSession(randomUUID(), 'PASSENGER')}`;
    const quote = await request(app).post('/rides/quote').set('Cookie', cookie)
      .send({ pickupZone: 'BANANI', dropoffZone: 'MOHAKHALI' });
    expect(quote.status).toBe(200);
    expect(quote.body.corridorId).toBe('CORRIDOR_BANANI_SOUTH');
    expect(quote.body.fare.totalFarePoysha).toBe(2500);
    expect(quote.body.potentialPooledFare.totalFarePoysha).toBe(2000);
    expect((await request(app).post('/rides/quote').set('Cookie', cookie)
      .send({ pickupZone: 'BANANI', dropoffZone: 'MOHAKHALI', seatsRequested: 4 })).status).toBe(400);
    expect((await request(app).post('/rides/quote').set('Cookie', cookie)
      .send({ pickupZone: 'BANANI', dropoffZone: 'BANANI' })).status).toBe(400);
  });

  it('validates auth requests and clears the session on logout', async () => {
    expect((await request(app).post('/auth/login').send({})).status).toBe(400);
    expect((await request(app).post('/auth/register').send({})).status).toBe(400);
    const logout = await request(app).post('/auth/logout');
    expect(logout.body).toEqual({ ok: true });
    expect(logout.headers['set-cookie'][0]).toContain('dtp_session=;');
  });
});
