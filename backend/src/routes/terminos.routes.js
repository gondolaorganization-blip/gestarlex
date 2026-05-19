import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/terminos.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

// Vistas globales de la firma
router.get('/proximos', asyncHandler(ctrl.proximosAVencer));
router.get('/vencidos', asyncHandler(ctrl.vencidos));

// CRUD anidado bajo caso
router.get('/caso/:casoId', asyncHandler(ctrl.listarPorCaso));
router.post('/caso/:casoId', minRol('ASOCIADO'), asyncHandler(ctrl.crear));

// Operaciones sobre término específico
router.get('/:id', asyncHandler(ctrl.obtener));
router.put('/:id', minRol('ASOCIADO'), asyncHandler(ctrl.actualizar));
router.patch('/:id/completar', asyncHandler(ctrl.completar));
router.delete('/:id', minRol('SOCIO'), asyncHandler(ctrl.eliminar));

export default router;
