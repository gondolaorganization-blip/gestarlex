import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/casos.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

// Vistas especiales
router.get('/kanban', asyncHandler(ctrl.kanban));

// CRUD principal
router.get('/', asyncHandler(ctrl.listar));
router.get('/:id', asyncHandler(ctrl.obtener));
router.post('/', minRol('ASOCIADO'), asyncHandler(ctrl.crear));
router.put('/:id', minRol('ASOCIADO'), asyncHandler(ctrl.actualizar));

// Estado y asignaciones
router.patch('/:id/estado', minRol('ASOCIADO'), asyncHandler(ctrl.cambiarEstado));
router.post('/:id/abogados', minRol('SOCIO'), asyncHandler(ctrl.asignarAbogado));
router.delete('/:id/abogados/:abogadoId', minRol('SOCIO'), asyncHandler(ctrl.removerAbogado));
router.post('/:id/clientes', minRol('SOCIO'), asyncHandler(ctrl.agregarCliente));
router.delete('/:id/clientes/:clienteId', minRol('SOCIO'), asyncHandler(ctrl.removerCliente));

// Timeline y estadísticas
router.get('/:id/timeline', asyncHandler(ctrl.timeline));
router.get('/:id/estadisticas', asyncHandler(ctrl.estadisticas));

export default router;
