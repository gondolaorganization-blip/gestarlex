import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import * as ctrl from '../controllers/paypal.controller.js';

const router = Router();

// Pública — planes disponibles (el frontend necesita los paypalPlanIds)
router.get('/planes', asyncHandler(ctrl.getPlanes));

// Webhook de PayPal — público pero verificado con firma
router.post('/webhook', asyncHandler(ctrl.webhook));

// Protegidas — requieren sesión de firma
router.post('/activar', authenticate, asyncHandler(ctrl.activarSuscripcion));
router.post('/cancelar', authenticate, asyncHandler(ctrl.cancelarSuscripcion));

export default router;
