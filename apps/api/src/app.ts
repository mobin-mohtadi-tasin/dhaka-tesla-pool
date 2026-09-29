import express from 'express';
import cookieParser from 'cookie-parser';
import { HttpError } from './shared/httpError';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import rideRoutes from './routes/rideRoutes';
import driverRoutes from './routes/driverRoutes';
import vehicleRoutes from './routes/vehicleRoutes';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);
app.use('/rides', rideRoutes);
app.use('/driver', driverRoutes);
app.use('/vehicles', vehicleRoutes);
app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
app.use(errorHandler);

export default app;
