import api from './client';

export const getProductividad = (params) =>
  api.get('/reportes/productividad', { params }).then((r) => r.data.data);

export const getRentabilidadCasos = (params) =>
  api.get('/reportes/rentabilidad/casos', { params }).then((r) => r.data.data);

export const getRentabilidadClientes = (params) =>
  api.get('/reportes/rentabilidad/clientes', { params }).then((r) => r.data.data);

export const getIngresosTipo = (params) =>
  api.get('/reportes/ingresos/tipo', { params }).then((r) => r.data.data);

export const getEstadisticasCasos = (params) =>
  api.get('/reportes/casos/estadisticas', { params }).then((r) => r.data.data);

export const getAgingReporte = () =>
  api.get('/reportes/aging').then((r) => r.data.data);

export const descargarPdfProductividad = (params) =>
  api.get('/reportes/pdf/productividad', { params, responseType: 'blob' });

export const descargarPdfRentabilidadCasos = (params) =>
  api.get('/reportes/pdf/rentabilidad/casos', { params, responseType: 'blob' });

export const descargarPdfAging = () =>
  api.get('/reportes/pdf/aging', { responseType: 'blob' });
