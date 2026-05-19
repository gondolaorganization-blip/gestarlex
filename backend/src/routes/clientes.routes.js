import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import * as ctrl from '../controllers/clientes.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

router.get('/', asyncHandler(ctrl.listar));
router.get('/:id', asyncHandler(ctrl.obtener));
router.post('/', asyncHandler(ctrl.crear));
router.put('/:id', asyncHandler(ctrl.actualizar));

export default router;
