import { Router } from 'express';
import { asyncRoute } from '../shared/asyncRoute';
import { requireAuth } from '../middleware/auth';
import { currentUser, loginUser, logoutUser, registerUser } from '../controllers/authController';

const router = Router();
router.post('/register', asyncRoute(registerUser));
router.post('/login', asyncRoute(loginUser));
router.post('/logout', logoutUser);
router.get('/me', requireAuth, asyncRoute(currentUser));
export default router;
