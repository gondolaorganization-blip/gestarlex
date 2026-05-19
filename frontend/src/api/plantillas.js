import api from './client';

export const getPlantillas = () =>
  api.get('/plantillas').then((r) => r.data.data);

export const getPlantilla = (id) =>
  api.get(`/plantillas/${id}`).then((r) => r.data.data);

export const renderizarPlantilla = (id, variables) =>
  api.post(`/plantillas/${id}/renderizar`, { variables }).then((r) => r.data.data);
