import api from './client';

export const getHonorarioConfig = (casoId) =>
  api.get(`/honorarios/config/${casoId}`)
    .then((r) => r.data.data)
    .catch((err) => (err.response?.status === 404 ? null : Promise.reject(err)));

export const upsertHonorarioConfig = (casoId, data) =>
  api.put(`/honorarios/config/${casoId}`, data).then((r) => r.data.data);

export const getHorasCaso = (casoId) =>
  api.get(`/honorarios/horas/${casoId}`).then((r) => r.data.data);

export const registrarHoras = (casoId, data) =>
  api.post(`/honorarios/horas/${casoId}`, data).then((r) => r.data.data);

export const actualizarHoras = (id, data) =>
  api.put(`/honorarios/horas/${id}`, data).then((r) => r.data.data);

export const eliminarHoras = (id) =>
  api.delete(`/honorarios/horas/${id}`).then((r) => r.data.data);

export const getResumenMensual = (mes, anio) =>
  api.get('/honorarios/resumen', { params: { mes, anio } }).then((r) => r.data.data);
