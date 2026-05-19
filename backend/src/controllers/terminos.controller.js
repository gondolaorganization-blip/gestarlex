import { z } from 'zod';
import * as svc from '../services/terminos.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const crearSchema = z.object({
  descripcion: z.string().min(5, 'Descripción requerida.'),
  fechaVence: z.string({ required_error: 'Fecha de vencimiento requerida.' }),
  diasAlerta: z.number().int().min(1).max(30).optional(),
  prioridad: z.enum(['ALTA', 'MEDIA', 'BAJA']).optional(),
  notas: z.string().optional(),
});

export const listarPorCaso = async (req, res) => {
  const data = await svc.listarPorCaso(req.params.casoId, req.user.firmaId);
  ok(res, data);
};

export const obtener = async (req, res) => {
  const data = await svc.obtener(req.params.id, req.user.firmaId);
  ok(res, data);
};

export const crear = async (req, res) => {
  const result = crearSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos del término procesal inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.crear(req.params.casoId, result.data, req.user.firmaId, req.user.rol);
  created(res, data);
};

export const actualizar = async (req, res) => {
  const data = await svc.actualizar(req.params.id, req.body, req.user.firmaId, req.user.rol);
  ok(res, data);
};

export const completar = async (req, res) => {
  const data = await svc.completar(req.params.id, req.user.firmaId);
  ok(res, data);
};

export const eliminar = async (req, res) => {
  await svc.eliminar(req.params.id, req.user.firmaId, req.user.rol);
  ok(res, { message: 'Término procesal eliminado.' });
};

export const proximosAVencer = async (req, res) => {
  const data = await svc.proximosAVencer(req.user.firmaId);
  ok(res, data);
};

export const vencidos = async (req, res) => {
  const data = await svc.vencidos(req.user.firmaId);
  ok(res, data);
};
