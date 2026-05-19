import api from './client';

export const getTareas = (casoId) =>
  api.get(`/tareas/caso/${casoId}`).then((r) => r.data.data);

export const crearTarea = (casoId, data) =>
  api.post(`/tareas/caso/${casoId}`, data).then((r) => r.data.data);

export const completarTarea = (id) =>
  api.patch(`/tareas/${id}/completar`).then((r) => r.data.data);
