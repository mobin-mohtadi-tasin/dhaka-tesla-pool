import { Router } from 'express';
import { asyncRoute } from '../shared/asyncRoute';
import { requireRole } from '../middleware/auth';
import { currentVehicle, updateAvailability } from '../controllers/driverController';

const router = Router();
router.get('/me', requireRole('DRIVER'), asyncRoute(currentVehicle));
router.post('/status', requireRole('DRIVER'), asyncRoute(updateAvailability));
export default router;
