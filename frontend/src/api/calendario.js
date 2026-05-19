import api from './client';

export const getCalendarioMensual = (year, month) =>
  api.get('/calendario/mensual', { params: { year, month } }).then((r) => r.data.data);

export const getCalendarioSemanal = (fecha) =>
  api.get('/calendario/semanal', { params: { fecha } }).then((r) => r.data.data);

export const getAlertas = () =>
  api.get('/calendario/alertas').then((r) => r.data.data);
