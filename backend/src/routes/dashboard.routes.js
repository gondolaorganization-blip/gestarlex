import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import * as ctrl from '../controllers/dashboard.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

router.get('/', asyncHandler(ctrl.obtener));         // Dashboard completo
router.get('/metricas', asyncHandler(ctrl.metricas)); // KPIs rápidos para widgets

export default router;
