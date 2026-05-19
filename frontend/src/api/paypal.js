import api from './client';

export const getPlanes = () =>
  api.get('/paypal/planes').then((r) => r.data.data);

export const activarSuscripcion = (subscriptionId) =>
  api.post('/paypal/activar', { subscriptionId }).then((r) => r.data.data);

export const cancelarSuscripcion = () =>
  api.post('/paypal/cancelar').then((r) => r.data.data);
