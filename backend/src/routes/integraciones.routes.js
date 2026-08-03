import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import { apiKeyAuth, requireScope, rateLimit } from '../middleware/apiKey.js';
import * as ctrl from '../controllers/integraciones.controller.js';

const router = Router();

// Primera barrera, por IP y ANTES de autenticar: una ráfaga con keys inválidas nunca
// llega a consultar la base. El límite por key viene después, ya autenticado.
// Depende de `trust proxy` (configurado en index.js) para ver la IP real del cliente.
router.use(rateLimit({ max: 300, ventanaMs: 60_000, clave: (req) => req.ip || 'desconocido' }));

// ─── GESTIÓN DE KEYS ──────────────────────────────────────────────────────────
// Se administran con el login normal del abogado, no con una API key:
// una key no puede crear ni ampliar otras keys.

const keys = Router();
keys.use(authenticate, verificarAcceso, minRol('SOCIO'));

keys.get('/', asyncHandler(ctrl.listarKeys));
keys.post('/', asyncHandler(ctrl.crearKey));
keys.post('/:id/revocar', asyncHandler(ctrl.revocarKey));

router.use('/keys', keys);

// ─── API PARA AUTOMATIZACIONES ────────────────────────────────────────────────
// Autenticada por API key. verificarAcceso mantiene la regla de suscripción:
// si la firma está suspendida o vencida, la API tampoco responde.
//
// No hay rutas de borrado en este router, y no es un olvido: es el límite.

const automatizaciones = Router();
automatizaciones.use(apiKeyAuth, rateLimit({ max: 60, ventanaMs: 60_000 }), verificarAcceso);

automatizaciones.get('/ping', asyncHandler(ctrl.ping));

// Lectura
automatizaciones.get('/casos', requireScope('casos:read'), asyncHandler(ctrl.listarCasos));
automatizaciones.get('/casos/:id', requireScope('casos:read'), asyncHandler(ctrl.obtenerCaso));
automatizaciones.get('/casos/:id/timeline', requireScope('casos:read'), asyncHandler(ctrl.timelineCaso));
automatizaciones.get('/pendientes', requireScope('casos:read'), asyncHandler(ctrl.listarPendientes));

// Actualización
automatizaciones.patch('/casos/:id/estado', requireScope('casos:write'), asyncHandler(ctrl.cambiarEstado));
automatizaciones.patch('/casos/:id/actividad', requireScope('casos:write'), asyncHandler(ctrl.registrarActividad));
automatizaciones.post('/casos/:id/pendientes', requireScope('casos:write'), asyncHandler(ctrl.crearPendiente));
automatizaciones.post('/casos/:id/documentos', requireScope('casos:write'), asyncHandler(ctrl.referenciarDocumento));

router.use('/', automatizaciones);

export default router;
