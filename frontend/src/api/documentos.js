import api from './client';

export const getEstadisticasDocumentos = () =>
  api.get('/documentos/estadisticas').then((r) => r.data.data);

export const getDocumentosCaso = (casoId) =>
  api.get(`/documentos/caso/${casoId}`).then((r) => r.data.data);

export const subirDocumento = (casoId, file, datos = {}) => {
  const fd = new FormData();
  fd.append('archivo', file);
  if (datos.nombre) fd.append('nombre', datos.nombre);
  if (datos.tipo) fd.append('tipo', datos.tipo);
  if (datos.descripcion) fd.append('descripcion', datos.descripcion);
  if (datos.confidencial !== undefined) fd.append('confidencial', String(datos.confidencial));
  return api.post(`/documentos/caso/${casoId}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data.data);
};

export const eliminarDocumento = (id) =>
  api.delete(`/documentos/${id}`).then((r) => r.data.data);
