import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import * as ctrl from '../controllers/calendario.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

router.get('/mensual', asyncHandler(ctrl.mensual));    // ?year=2025&month=5
router.get('/semanal', asyncHandler(ctrl.semanal));    // ?fecha=2025-05-14
router.get('/alertas', asyncHandler(ctrl.alertas));    // alertas críticas

export default router;
