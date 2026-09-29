import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { HttpError } from '../shared/httpError';

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  void _next;
  if (error instanceof ZodError) return res.status(400).json({ error: 'Invalid request', details: error.flatten() });
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ error: 'Duplicate record' });
  res.status(500).json({ error: 'Internal server error' });
};
