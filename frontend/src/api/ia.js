import api from './client';

export const consultarIA = (data) =>
  api.post('/ia/consulta', data).then((r) => r.data.data);

export const getUsoIA = () =>
  api.get('/ia/uso').then((r) => r.data.data);
