import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { HttpError } from './errors';

type Session = { userId: string; role: Role; expires: number };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  return value;
}

export function issueSession(userId: string, role: Role) {
  const payload: Session & { nonce: string } = { userId, role, expires: Date.now() + 7 * 86_400_000, nonce: randomBytes(16).toString('hex') };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function readSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [body, signature, extra] = token.split('.');
  if (!body || !signature || extra) return null;
  const expected = createHmac('sha256', secret()).update(body).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const value: unknown = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (typeof value !== 'object' || value === null) return null;
    const item = value as Partial<Session>;
    if (typeof item.userId !== 'string' || (item.role !== 'PASSENGER' && item.role !== 'DRIVER') || typeof item.expires !== 'number' || item.expires < Date.now()) return null;
    return item as Session;
  } catch { return null; }
}

declare module 'express-serve-static-core' {
  interface Request { session?: Session }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const session = readSession(req.cookies?.dtp_session);
  if (!session) return next(new HttpError(401, 'Sign in required'));
  req.session = session;
  next();
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => requireAuth(req, res, (error?: unknown) => {
    if (error) return next(error);
    if (req.session?.role !== role) return next(new HttpError(403, 'Forbidden'));
    next();
  });
}

export function sessionCookie(res: Response, token: string) {
  res.cookie('dtp_session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 7 * 86_400_000, path: '/' });
}
