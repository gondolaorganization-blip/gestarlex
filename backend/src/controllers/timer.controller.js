import { z } from 'zod';
import * as svc from '../services/timer.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const iniciarSchema = z.object({
  casoId: z.string().min(1, 'casoId requerido.'),
  descripcion: z.string().optional(),
});

const detenerSchema = z.object({
  descripcion: z.string().optional(),
  facturable: z.boolean().optional(),
  redondearCuartoHora: z.boolean().optional(),
  forzar: z.boolean().optional(),
});

export const iniciar = async (req, res) => {
  const result = iniciarSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.iniciar(result.data.casoId, result.data.descripcion, req.user.firmaId, req.user);
  created(res, data);
};

export const pausar = async (req, res) => {
  const data = await svc.pausar(req.params.id, req.user);
  ok(res, data);
};

export const reanudar = async (req, res) => {
  const data = await svc.reanudar(req.params.id, req.user);
  ok(res, data);
};

export const detener = async (req, res) => {
  const result = detenerSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Opciones inválidas.', result.error.flatten().fieldErrors);
  }
  const data = await svc.detener(req.params.id, result.data, req.user);
  ok(res, data);
};

export const descartar = async (req, res) => {
  const data = await svc.descartar(req.params.id, req.user);
  ok(res, data);
};

export const obtener = async (req, res) => {
  const data = await svc.obtener(req.params.id, req.user);
  ok(res, data);
};

export const misTimers = async (req, res) => {
  const data = await svc.misTimers(req.user);
  ok(res, data);
};

export const timersFirma = async (req, res) => {
  const data = await svc.timersFirma(req.user.firmaId);
  ok(res, data);
};

export const timerDelCaso = async (req, res) => {
  const data = await svc.timerDelCaso(req.params.casoId, req.user.firmaId, req.user);
  ok(res, data);
};
