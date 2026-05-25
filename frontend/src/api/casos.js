import api from './client';

export const getCasos = (params) =>
  api.get('/casos', { params }).then((r) => r.data.data);

export const getKanban = () =>
  api.get('/casos/kanban').then((r) => r.data.data);

export const getCaso = (id) =>
  api.get(`/casos/${id}`).then((r) => r.data.data);

export const getTimeline = (id) =>
  api.get(`/casos/${id}/timeline`).then((r) => r.data.data);

export const getEstadisticas = (id) =>
  api.get(`/casos/${id}/estadisticas`).then((r) => r.data.data);

export const crearCaso = (data) =>
  api.post('/casos', data).then((r) => r.data.data);

export const actualizarCaso = (id, data) =>
  api.put(`/casos/${id}`, data).then((r) => r.data.data);

export const cambiarEstado = (id, estado, nota) =>
  api.patch(`/casos/${id}/estado`, { estado, nota }).then((r) => r.data.data);

export const agregarClienteCaso = (casoId, clienteId, rol) =>
  api.post(`/casos/${casoId}/clientes`, { clienteId, rol }).then((r) => r.data.data);

export const removerClienteCaso = (casoId, clienteId) =>
  api.delete(`/casos/${casoId}/clientes/${clienteId}`).then((r) => r.data.data);
