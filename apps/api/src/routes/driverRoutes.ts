import { Router } from 'express';
import { asyncRoute } from '../shared/asyncRoute';
import { requireRole } from '../middleware/auth';
import { activePool, poolAction, tripHistory } from '../controllers/driverController';

const router = Router();
router.get('/rides', requireRole('DRIVER'), asyncRoute(activePool));
router.get('/history', requireRole('DRIVER'), asyncRoute(tripHistory));
for (const action of ['arrive', 'start', 'complete'] as const) {
  router.post(`/rides/:id/${action}`, requireRole('DRIVER'), asyncRoute(poolAction(action)));
}
export default router;
