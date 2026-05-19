import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/facturas.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

// Aging report — cuentas por cobrar
router.get('/aging', asyncHandler(ctrl.agingReport));

// CRUD
router.get('/', asyncHandler(ctrl.listar));
router.get('/:id', asyncHandler(ctrl.obtener));
router.post('/', minRol('ASOCIADO'), asyncHandler(ctrl.crear));
router.patch('/:id/estado', minRol('ASOCIADO'), asyncHandler(ctrl.cambiarEstado));

// Generación automática desde caso
router.post('/generar/:casoId', minRol('ASOCIADO'), asyncHandler(ctrl.generarDesdeCaso));

export default router;
