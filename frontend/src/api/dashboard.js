import api from './client';

export const getDashboard = () =>
  api.get('/dashboard').then((r) => r.data.data);

export const getMetricas = () =>
  api.get('/dashboard/metricas').then((r) => r.data.data);
