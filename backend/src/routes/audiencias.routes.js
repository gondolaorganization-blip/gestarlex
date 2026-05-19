import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/audiencias.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

// Vista global de la firma — próximas audiencias con alertas
router.get('/proximas', asyncHandler(ctrl.proximas));

// CRUD anidado bajo /casos/:casoId/audiencias
router.get('/caso/:casoId', asyncHandler(ctrl.listarPorCaso));
router.post('/caso/:casoId', minRol('ASOCIADO'), asyncHandler(ctrl.crear));

// Operaciones sobre audiencia específica
router.get('/:id', asyncHandler(ctrl.obtener));
router.put('/:id', minRol('ASOCIADO'), asyncHandler(ctrl.actualizar));
router.delete('/:id', minRol('SOCIO'), asyncHandler(ctrl.eliminar));

export default router;
