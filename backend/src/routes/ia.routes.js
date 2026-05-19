import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import * as ctrl from '../controllers/ia.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

router.post('/consulta', asyncHandler(ctrl.consultar));
router.get('/uso', asyncHandler(ctrl.getUso));

export default router;
