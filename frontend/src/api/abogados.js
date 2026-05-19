import api from './client';

export const getAbogados = () =>
  api.get('/abogados').then((r) => r.data.data);

export const getAbogado = (id) =>
  api.get(`/abogados/${id}`).then((r) => r.data.data);

export const crearAbogado = (data) =>
  api.post('/abogados', data).then((r) => r.data.data);

export const actualizarAbogado = (id, data) =>
  api.put(`/abogados/${id}`, data).then((r) => r.data.data);

export const desactivarAbogado = (id) =>
  api.delete(`/abogados/${id}`).then((r) => r.data.data);
