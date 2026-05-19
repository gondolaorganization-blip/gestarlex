import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/comunicaciones.controller.js';

const router = Router();
router.use(authenticate, verificarAcceso);

router.get('/caso/:casoId', asyncHandler(ctrl.listarPorCaso));
router.get('/caso/:casoId/email-logs', asyncHandler(ctrl.emailLogsPorCaso));
router.get('/cliente/:clienteId', asyncHandler(ctrl.listarPorCliente));
router.post('/', asyncHandler(ctrl.crear));
router.post('/cotizacion/email', asyncHandler(ctrl.enviarCotizacion));
router.put('/:id', asyncHandler(ctrl.actualizar));
router.delete('/:id', minRol('SOCIO'), asyncHandler(ctrl.eliminar));

export default router;
