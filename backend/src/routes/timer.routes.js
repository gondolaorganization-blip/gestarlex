import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/timer.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

// Mis timers activos (usuario autenticado)
router.get('/mis-timers', asyncHandler(ctrl.misTimers));

// Todos los timers de la firma (SOCIO+)
router.get('/firma', minRol('SOCIO'), asyncHandler(ctrl.timersFirma));

// Timer de un caso específico del usuario
router.get('/caso/:casoId', asyncHandler(ctrl.timerDelCaso));

// Iniciar timer (crea nuevo o reanuda el pausado del mismo caso)
router.post('/', asyncHandler(ctrl.iniciar));

// Control del timer por ID
router.get('/:id', asyncHandler(ctrl.obtener));
router.patch('/:id/pausar', asyncHandler(ctrl.pausar));
router.patch('/:id/reanudar', asyncHandler(ctrl.reanudar));
router.post('/:id/detener', asyncHandler(ctrl.detener));
router.delete('/:id', asyncHandler(ctrl.descartar));

export default router;
