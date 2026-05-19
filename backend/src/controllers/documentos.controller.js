import * as svc from '../services/documentos.service.js';
import { ok, created } from '../utils/response.js';
import { AppError } from '../utils/errors.js';

export const listarPorCaso = async (req, res) => {
  const data = await svc.listarPorCaso(req.params.casoId, req.user.firmaId, req.user);
  ok(res, data);
};

export const obtener = async (req, res) => {
  const data = await svc.obtener(req.params.id, req.user.firmaId, req.user);
  ok(res, data);
};

export const subir = async (req, res) => {
  if (!req.file) throw new AppError('No se recibió ningún archivo.', 400);
  const data = await svc.subir(req.params.casoId, req.file, req.body, req.user.firmaId, req.user);
  created(res, data);
};

export const actualizarMetadatos = async (req, res) => {
  const data = await svc.actualizarMetadatos(req.params.id, req.body, req.user.firmaId, req.user);
  ok(res, data);
};

export const eliminar = async (req, res) => {
  await svc.eliminar(req.params.id, req.user.firmaId, req.user);
  ok(res, { message: 'Documento eliminado.' });
};

export const descargar = async (req, res) => {
  const { ruta, nombre, mimeType } = await svc.obtenerRutaDescarga(
    req.params.id,
    req.user.firmaId,
    req.user
  );

  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre)}"`);
  res.setHeader('Content-Type', mimeType);
  res.sendFile(ruta);
};

export const versiones = async (req, res) => {
  const { nombre } = req.query;
  if (!nombre) throw new AppError('Parámetro "nombre" requerido.', 400);
  const data = await svc.versiones(req.params.casoId, nombre, req.user.firmaId, req.user);
  ok(res, data);
};

export const estadisticasFirma = async (req, res) => {
  const data = await svc.estadisticasFirma(req.user.firmaId);
  ok(res, data);
};
