import { z } from 'zod';
import * as svc from '../services/gastos.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const crearSchema = z.object({
  descripcion: z.string().min(3, 'Descripción requerida.'),
  monto: z.number().positive('El monto debe ser mayor a 0.'),
  tipo: z.enum(['TASA_JUDICIAL', 'NOTARIA', 'TRANSPORTE', 'REGISTRO', 'OTRO']).optional(),
  fecha: z.string().optional(),
  reembolsable: z.boolean().optional(),
  comprobante: z.string().optional(),
});

export const listarPorCaso = async (req, res) => {
  const data = await svc.listarPorCaso(req.params.casoId, req.user.firmaId);
  ok(res, data);
};

export const listarFirma = async (req, res) => {
  const data = await svc.listarFirma(req.user.firmaId, req.query);
  ok(res, data);
};

export const crear = async (req, res) => {
  const result = crearSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos del gasto inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.crear(req.params.casoId, result.data, req.user.firmaId, req.user);
  created(res, data);
};

export const actualizar = async (req, res) => {
  const data = await svc.actualizar(req.params.id, req.body, req.user.firmaId, req.user);
  ok(res, data);
};

export const marcarReembolsado = async (req, res) => {
  const data = await svc.marcarReembolsado(req.params.id, req.user.firmaId, req.user);
  ok(res, data);
};

export const eliminar = async (req, res) => {
  await svc.eliminar(req.params.id, req.user.firmaId, req.user);
  ok(res, { message: 'Gasto eliminado.' });
};
