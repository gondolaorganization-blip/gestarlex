import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import * as auth from '../controllers/auth.controller.js';

const router = Router();

// Públicas
router.post('/login', asyncHandler(auth.login));
router.post('/refresh', asyncHandler(auth.refresh));
router.post('/logout', asyncHandler(auth.logout));

// Protegidas
router.get('/me', authenticate, asyncHandler(auth.me));
router.post('/logout-todos', authenticate, asyncHandler(auth.logoutTodos));
router.put('/cambiar-password', authenticate, asyncHandler(auth.cambiarPassword));

export default router;
