import api from './client';

export const getFacturas = (params) =>
  api.get('/facturas', { params }).then((r) => r.data.data);

export const getFactura = (id) =>
  api.get(`/facturas/${id}`).then((r) => r.data.data);

export const getAging = () =>
  api.get('/facturas/aging').then((r) => r.data.data);

export const crearFactura = (data) =>
  api.post('/facturas', data).then((r) => r.data.data);

export const actualizarFactura = (id, data) =>
  api.put(`/facturas/${id}`, data).then((r) => r.data.data);

export const cambiarEstadoFactura = (id, estado) =>
  api.patch(`/facturas/${id}/estado`, { estado }).then((r) => r.data.data);

export const generarFacturaDesdeCaso = (casoId, datos = {}) =>
  api.post(`/facturas/generar/${casoId}`, datos).then((r) => r.data.data);
