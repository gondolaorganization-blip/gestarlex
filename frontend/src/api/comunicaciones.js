import api from './client';

export const getComunicacionesCaso = (casoId) =>
  api.get(`/comunicaciones/caso/${casoId}`).then((r) => r.data.data);

export const getComunicacionesCliente = (clienteId) =>
  api.get(`/comunicaciones/cliente/${clienteId}`).then((r) => r.data.data);

export const crearComunicacion = (data) =>
  api.post('/comunicaciones', data).then((r) => r.data.data);

export const actualizarComunicacion = (id, data) =>
  api.put(`/comunicaciones/${id}`, data).then((r) => r.data.data);

export const eliminarComunicacion = (id) =>
  api.delete(`/comunicaciones/${id}`).then((r) => r.data.data);

export const getEmailLogsCaso = (casoId) =>
  api.get(`/comunicaciones/caso/${casoId}/email-logs`).then((r) => r.data.data);

export const enviarCotizacion = (data) =>
  api.post('/comunicaciones/cotizacion/email', data).then((r) => r.data.data);
