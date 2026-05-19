import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import * as ctrl from '../controllers/plantillas.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

router.get('/', asyncHandler(ctrl.listar));
router.get('/:id', asyncHandler(ctrl.obtener));
router.post('/:id/renderizar', asyncHandler(ctrl.renderizar));

export default router;
