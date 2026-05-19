import api from './client';

export const getTerminos = (casoId) =>
  api.get(`/terminos/caso/${casoId}`).then((r) => r.data.data);

export const crearTermino = (casoId, data) =>
  api.post(`/terminos/caso/${casoId}`, data).then((r) => r.data.data);

export const completarTermino = (id) =>
  api.patch(`/terminos/${id}/completar`).then((r) => r.data.data);
