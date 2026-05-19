import api from './client';

export const getGastosCaso = (casoId) =>
  api.get(`/gastos/caso/${casoId}`).then((r) => r.data.data);

export const getGastosFirma = (params) =>
  api.get('/gastos', { params }).then((r) => r.data.data);

export const crearGasto = (casoId, data) =>
  api.post(`/gastos/caso/${casoId}`, data).then((r) => r.data.data);

export const actualizarGasto = (id, data) =>
  api.put(`/gastos/${id}`, data).then((r) => r.data.data);

export const marcarReembolsadoGasto = (id) =>
  api.patch(`/gastos/${id}/reembolsar`).then((r) => r.data.data);

export const eliminarGasto = (id) =>
  api.delete(`/gastos/${id}`).then((r) => r.data.data);
