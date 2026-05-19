import api from './client';

export const getPoderes = (params) =>
  api.get('/poderes', { params }).then((r) => r.data.data);

export const getResumenPoderes = () =>
  api.get('/poderes/resumen').then((r) => r.data.data);

export const getProximosAVencer = (dias = 30) =>
  api.get('/poderes/proximos', { params: { dias } }).then((r) => r.data.data);

export const getVencidos = () =>
  api.get('/poderes/vencidos').then((r) => r.data.data);

export const crearPoder = (data) =>
  api.post('/poderes', data).then((r) => r.data.data);

export const revocarPoder = (id) =>
  api.patch(`/poderes/${id}/revocar`).then((r) => r.data.data);
