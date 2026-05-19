import api from './client';

export const getMisTimers = () =>
  api.get('/timer/mis-timers').then((r) => r.data.data);

export const iniciarTimer = (casoId, descripcion) =>
  api.post('/timer', { casoId, descripcion }).then((r) => r.data.data);

export const pausarTimer = (id) =>
  api.patch(`/timer/${id}/pausar`).then((r) => r.data.data);

export const reanudarTimer = (id) =>
  api.patch(`/timer/${id}/reanudar`).then((r) => r.data.data);

export const detenerTimer = (id, opciones) =>
  api.post(`/timer/${id}/detener`, opciones).then((r) => r.data.data);

export const descartarTimer = (id) =>
  api.delete(`/timer/${id}`).then((r) => r.data.data);
