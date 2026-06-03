import api from './client';

export const getTareas = (casoId) =>
  api.get(`/tareas/caso/${casoId}`).then((r) => r.data.data);

export const getTodasPendientes = (params = {}) =>
  api.get('/tareas/todas', { params }).then((r) => r.data.data);

export const crearTarea = (casoId, data) =>
  api.post(`/tareas/caso/${casoId}`, data).then((r) => r.data.data);

export const completarTarea = (id) =>
  api.patch(`/tareas/${id}/completar`).then((r) => r.data.data);

export const actualizarTarea = (id, data) =>
  api.put(`/tareas/${id}`, data).then((r) => r.data.data);

export const getNotasTareas = () =>
  api.get('/tareas/notas').then((r) => r.data.data);

export const guardarNotasTareas = (notas) =>
  api.put('/tareas/notas', { notas }).then((r) => r.data.data);
