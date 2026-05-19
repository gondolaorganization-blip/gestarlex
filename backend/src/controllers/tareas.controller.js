import { z } from 'zod';
import * as svc from '../services/tareas.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const crearSchema = z.object({
  descripcion: z.string().min(3, 'Descripción requerida.'),
  abogadoId: z.string().optional(),
  fechaLimite: z.string().optional(),
  prioridad: z.enum(['ALTA', 'MEDIA', 'BAJA']).optional(),
  notas: z.string().optional(),
});

export const listarPorCaso = async (req, res) => {
  const data = await svc.listarPorCaso(req.params.casoId, req.user.firmaId, req.user);
  ok(res, data);
};

export const misTareas = async (req, res) => {
  const data = await svc.misTareas(req.user.firmaId, req.user);
  ok(res, data);
};

export const crear = async (req, res) => {
  const result = crearSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos de la tarea inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.crear(req.params.casoId, result.data, req.user.firmaId, req.user);
  created(res, data);
};

export const actualizar = async (req, res) => {
  const data = await svc.actualizar(req.params.id, req.body, req.user.firmaId, req.user);
  ok(res, data);
};

export const completar = async (req, res) => {
  const data = await svc.completar(req.params.id, req.user.firmaId, req.user);
  ok(res, data);
};

export const eliminar = async (req, res) => {
  await svc.eliminar(req.params.id, req.user.firmaId, req.user);
  ok(res, { message: 'Tarea eliminada.' });
};
