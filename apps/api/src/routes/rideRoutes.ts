import { Router } from 'express';
import { asyncRoute } from '../shared/asyncRoute';
import { requireRole } from '../middleware/auth';
import { cancelRequestedRide, quoteRide, requestRide, rideDetails, rideHistory } from '../controllers/rideController';

const router = Router();
router.post('/quote', requireRole('PASSENGER'), asyncRoute(quoteRide));
router.post('/', requireRole('PASSENGER'), asyncRoute(requestRide));
router.get('/', requireRole('PASSENGER'), asyncRoute(rideHistory));
router.get('/:id', requireRole('PASSENGER'), asyncRoute(rideDetails));
router.post('/:id/cancel', requireRole('PASSENGER'), asyncRoute(cancelRequestedRide));
export default router;
