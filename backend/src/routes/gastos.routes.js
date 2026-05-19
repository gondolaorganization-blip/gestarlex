import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/gastos.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

// Vista global de la firma
router.get('/', asyncHandler(ctrl.listarFirma));

// Por caso
router.get('/caso/:casoId', asyncHandler(ctrl.listarPorCaso));
router.post('/caso/:casoId', minRol('ASOCIADO'), asyncHandler(ctrl.crear));

// Operaciones sobre gasto individual
router.put('/:id', minRol('ASOCIADO'), asyncHandler(ctrl.actualizar));
router.patch('/:id/reembolsar', minRol('SOCIO'), asyncHandler(ctrl.marcarReembolsado));
router.delete('/:id', minRol('SOCIO'), asyncHandler(ctrl.eliminar));

export default router;
