import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { authenticate } from '../middleware/auth.js';
import { verificarAcceso } from '../middleware/acceso.js';
import { minRol } from '../middleware/roles.js';
import * as ctrl from '../controllers/google.controller.js';

const router = Router();

// ─── OAUTH ────────────────────────────────────────────────────────────────────

// El callback NO lleva authenticate: lo invoca el navegador viniendo de Google,
// sin el header Authorization. La identidad viaja en el `state` firmado con JWT,
// que el servicio verifica antes de guardar nada.
router.get('/oauth/callback', asyncHandler(ctrl.callbackOAuth));

// Conectar y desconectar es decisión de socio: afecta a toda la firma.
router.get('/oauth/inicio', authenticate, verificarAcceso, minRol('SOCIO'), asyncHandler(ctrl.iniciarOAuth));
router.delete('/conexion', authenticate, verificarAcceso, minRol('SOCIO'), asyncHandler(ctrl.desconectar));

// El estado lo puede consultar cualquier abogado autenticado (no expone tokens).
router.get('/estado', authenticate, verificarAcceso, asyncHandler(ctrl.estadoConexion));

// ─── SYNC E INCIDENCIAS ───────────────────────────────────────────────────────
// Todo lo que sigue exige login normal + suscripción activa. Ninguna de estas rutas
// es alcanzable con una API key: el sync no es una automatización de terceros.

const protegido = [authenticate, verificarAcceso, minRol('ASOCIADO')];

// Prueba controlada: empuja UN registro y devuelve el detalle.
router.get('/prueba/candidatos', ...protegido, asyncHandler(ctrl.listarCandidatos));
router.post('/prueba/empujar', ...protegido, asyncHandler(ctrl.probarEmpuje));

// Trae de Google lo que cambió (incremental, seguro de correr siempre).
router.post('/sync/entrada', ...protegido, asyncHandler(ctrl.sincronizarEntrada));

// Corrida completa — falla con 409 mientras el sync completo esté deshabilitado.
router.post('/sync/completo', ...protegido, asyncHandler(ctrl.sincronizarTodo));

// El interruptor del sync masivo es decisión de socio.
router.post('/sync/habilitar', authenticate, verificarAcceso, minRol('SOCIO'), asyncHandler(ctrl.habilitarSyncCompleto));

// Bandeja de conflictos y borrados pendientes de confirmación.
router.get('/incidencias', ...protegido, asyncHandler(ctrl.listarIncidencias));
router.post('/incidencias/:id/resolver', ...protegido, asyncHandler(ctrl.resolverIncidencia));

export default router;
