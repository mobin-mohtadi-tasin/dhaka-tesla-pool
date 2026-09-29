import type { Request, Response } from 'express';
import { issueSession, sessionCookie } from '../middleware/auth';
import { registration, loginInput } from '../validation/requests';
import { getSessionUser, login, publicUser, register } from '../services/authService';

export async function registerUser(req: Request, res: Response) {
  const input = registration.parse(req.body);
  const user = await register(input);
  sessionCookie(res, issueSession(user.id, user.role));
  res.status(201).json({ user: publicUser(user) });
}

export async function loginUser(req: Request, res: Response) {
  const input = loginInput.parse(req.body);
  const user = await login(input.phoneNumber, input.password);
  sessionCookie(res, issueSession(user.id, user.role));
  res.json({ user: publicUser(user) });
}

export async function currentUser(req: Request, res: Response) {
  const user = await getSessionUser(req.session!.userId, req.session!.role);
  res.json({ user: publicUser(user) });
}

export function logoutUser(_req: Request, res: Response) {
  res.clearCookie('dtp_session', { path: '/' });
  res.json({ ok: true });
}
