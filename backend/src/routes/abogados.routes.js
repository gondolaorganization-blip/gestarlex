import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/abogados.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

router.get('/', asyncHandler(ctrl.listar));
router.get('/:id', asyncHandler(ctrl.obtener));
router.post('/', minRol('SOCIO'), asyncHandler(ctrl.crear));
router.put('/:id', asyncHandler(ctrl.actualizar));
router.delete('/:id', minRol('SOCIO'), asyncHandler(ctrl.desactivar));

export default router;
