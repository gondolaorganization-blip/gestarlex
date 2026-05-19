import api from './client';

export const getClientes = (params) =>
  api.get('/clientes', { params }).then((r) => r.data.data);

export const getCliente = (id) =>
  api.get(`/clientes/${id}`).then((r) => r.data.data);

export const crearCliente = (data) =>
  api.post('/clientes', data).then((r) => r.data.data);

export const actualizarCliente = (id, data) =>
  api.put(`/clientes/${id}`, data).then((r) => r.data.data);
