import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/poderes.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

// Vistas globales de la firma
router.get('/', asyncHandler(ctrl.listarFirma));
router.get('/resumen', asyncHandler(ctrl.resumen));
router.get('/proximos', asyncHandler(ctrl.proximosAVencer));   // ?dias=30
router.get('/vencidos', asyncHandler(ctrl.vencidos));

// Por entidad
router.get('/cliente/:clienteId', asyncHandler(ctrl.listarPorCliente));
router.get('/caso/:casoId', asyncHandler(ctrl.listarPorCaso));

// CRUD individual
router.get('/:id', asyncHandler(ctrl.obtener));
router.post('/', minRol('ASOCIADO'), asyncHandler(ctrl.crear));
router.put('/:id', minRol('ASOCIADO'), asyncHandler(ctrl.actualizar));
router.patch('/:id/revocar', minRol('SOCIO'), asyncHandler(ctrl.revocar));

export default router;
