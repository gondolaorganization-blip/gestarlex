import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import * as ctrl from '../controllers/reportes.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

// ─── JSON (datos para el frontend) ───────────────────────────────────────────
router.get('/productividad',         asyncHandler(ctrl.productividad));
router.get('/rentabilidad/casos',    asyncHandler(ctrl.rentabilidadCasos));
router.get('/rentabilidad/clientes', asyncHandler(ctrl.rentabilidadClientes));
router.get('/ingresos/tipo',         asyncHandler(ctrl.ingresosPorTipo));
router.get('/casos/estadisticas',    asyncHandler(ctrl.estadisticasCasos));
router.get('/aging',                 asyncHandler(ctrl.agingHonorarios));

// ─── PDF ──────────────────────────────────────────────────────────────────────
router.get('/pdf/productividad',      asyncHandler(ctrl.productividadPdf));
router.get('/pdf/rentabilidad/casos', asyncHandler(ctrl.rentabilidadCasosPdf));
router.get('/pdf/aging',              asyncHandler(ctrl.agingPdf));

export default router;
