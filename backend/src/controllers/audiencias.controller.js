import { z } from 'zod';
import * as svc from '../services/audiencias.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const crearSchema = z.object({
  titulo: z.string().min(3, 'Título requerido.'),
  fecha: z.string({ required_error: 'Fecha requerida.' }),
  hora: z.string().optional(),
  juzgado: z.string().optional(),
  sala: z.string().optional(),
  tipo: z.string().optional(),
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
    throw new ValidationError('Datos de audiencia inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.crear(req.params.casoId, result.data, req.user.firmaId, req.user.rol);
  created(res, data);
};

export const actualizar = async (req, res) => {
  const data = await svc.actualizar(req.params.id, req.body, req.user.firmaId, req.user.rol);
  ok(res, data);
};

export const eliminar = async (req, res) => {
  await svc.eliminar(req.params.id, req.user.firmaId, req.user.rol);
  ok(res, { message: 'Audiencia eliminada.' });
};

export const proximas = async (req, res) => {
  const dias = Number(req.query.dias) || 7;
  const data = await svc.conAlertas(req.user.firmaId, dias);
  ok(res, data);
};
