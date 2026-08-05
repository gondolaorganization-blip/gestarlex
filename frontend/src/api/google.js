import api from './client';

// ─── CONEXIÓN ─────────────────────────────────────────────────────────────────

export const getEstadoGoogle = () =>
  api.get('/google/estado').then((r) => r.data.data);

/** Devuelve la URL de consentimiento de Google; el navegador se redirige ahí. */
export const iniciarConexionGoogle = () =>
  api.get('/google/oauth/inicio').then((r) => r.data.url);

export const desconectarGoogle = () =>
  api.delete('/google/conexion').then((r) => r.data);

// ─── SYNC ─────────────────────────────────────────────────────────────────────

/** Prueba controlada: empuja UN registro a Google. */
export const probarEmpuje = (tipo, id) =>
  api.post('/google/prueba/empujar', { tipo, id }).then((r) => r.data);

export const sincronizarEntrada = () =>
  api.post('/google/sync/entrada').then((r) => r.data);

export const sincronizarTodo = () =>
  api.post('/google/sync/completo').then((r) => r.data);

export const habilitarSyncCompleto = (habilitado) =>
  api.post('/google/sync/habilitar', { habilitado }).then((r) => r.data);

// ─── INCIDENCIAS ──────────────────────────────────────────────────────────────

export const getIncidencias = (estado = 'PENDIENTE') =>
  api.get('/google/incidencias', { params: { estado } }).then((r) => r.data.data);

export const resolverIncidencia = (id, resolucion) =>
  api.post(`/google/incidencias/${id}/resolver`, { resolucion }).then((r) => r.data.data);
