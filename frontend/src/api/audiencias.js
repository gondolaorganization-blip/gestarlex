import api from './client';

export const getAudiencias = (casoId) =>
  api.get(`/audiencias/caso/${casoId}`).then((r) => r.data.data);

export const getProximas = () =>
  api.get('/audiencias/proximas').then((r) => r.data.data);

export const crearAudiencia = (casoId, data) =>
  api.post(`/audiencias/caso/${casoId}`, data).then((r) => r.data.data);

export const actualizarAudiencia = (id, data) =>
  api.put(`/audiencias/${id}`, data).then((r) => r.data.data);
