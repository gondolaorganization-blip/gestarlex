import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/honorarios.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

// Resumen mensual de horas de la firma
router.get('/resumen', asyncHandler(ctrl.resumenMensual));   // ?mes=5&anio=2025

// Horas por abogado (para reportes de productividad)
router.get('/abogado/:abogadoId', asyncHandler(ctrl.listarHorasPorAbogado));

// Configuración de honorarios por caso
router.get('/config/:casoId', asyncHandler(ctrl.obtenerConfig));
router.put('/config/:casoId', minRol('ASOCIADO'), asyncHandler(ctrl.upsertConfig));

// Registro de horas por caso
router.get('/horas/:casoId', asyncHandler(ctrl.listarHorasPorCaso));
router.post('/horas/:casoId', asyncHandler(ctrl.registrarHoras));
router.put('/horas/:id', asyncHandler(ctrl.actualizarHoras));
router.delete('/horas/:id', asyncHandler(ctrl.eliminarHoras));

export default router;
