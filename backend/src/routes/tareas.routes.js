import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/tareas.controller.js';

const router = Router();
router.use(authenticate, verificarAcceso);

router.get('/mis-tareas', asyncHandler(ctrl.misTareas));
router.get('/caso/:casoId', asyncHandler(ctrl.listarPorCaso));
router.post('/caso/:casoId', asyncHandler(ctrl.crear));
router.put('/:id', asyncHandler(ctrl.actualizar));
router.patch('/:id/completar', asyncHandler(ctrl.completar));
router.delete('/:id', minRol('SOCIO'), asyncHandler(ctrl.eliminar));

export default router;
