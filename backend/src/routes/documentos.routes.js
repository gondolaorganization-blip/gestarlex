import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import { handleUpload } from '../middleware/upload.js';
import * as ctrl from '../controllers/documentos.controller.js';

const router = Router();

router.use(authenticate, verificarAcceso);

// Estadísticas globales de la firma
router.get('/estadisticas', asyncHandler(ctrl.estadisticasFirma));

// Documentos de un caso
router.get('/caso/:casoId', asyncHandler(ctrl.listarPorCaso));
router.get('/caso/:casoId/versiones', asyncHandler(ctrl.versiones)); // ?nombre=demanda.pdf
router.post('/caso/:casoId', handleUpload, asyncHandler(ctrl.subir));

// Operaciones sobre documento específico
router.get('/:id', asyncHandler(ctrl.obtener));
router.get('/:id/descargar', asyncHandler(ctrl.descargar));
router.put('/:id', minRol('ASOCIADO'), asyncHandler(ctrl.actualizarMetadatos));
router.delete('/:id', minRol('SOCIO'), asyncHandler(ctrl.eliminar));

export default router;
