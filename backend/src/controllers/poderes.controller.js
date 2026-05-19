import { z } from 'zod';
import * as svc from '../services/poderes.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const crearSchema = z.object({
  clienteId: z.string().min(1, 'Cliente requerido.'),
  casoId: z.string().optional(),
  tipo: z.enum(['GENERAL', 'ESPECIAL', 'JUDICIAL']).optional(),
  fechaOtorgamiento: z.string({ required_error: 'Fecha de otorgamiento requerida.' }),
  fechaVence: z.string().optional().nullable(),
  notaria: z.string().optional(),
  tomo: z.string().optional(),
  folio: z.string().optional(),
  descripcion: z.string().optional(),
});

export const listarFirma = async (req, res) => {
  const data = await svc.listarFirma(req.user.firmaId, req.query);
  ok(res, data);
};

export const listarPorCliente = async (req, res) => {
  const data = await svc.listarPorCliente(req.params.clienteId, req.user.firmaId);
  ok(res, data);
};

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
    throw new ValidationError('Datos del poder inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.crear(result.data, req.user.firmaId, req.user);
  created(res, data);
};

export const actualizar = async (req, res) => {
  const data = await svc.actualizar(req.params.id, req.body, req.user.firmaId, req.user);
  ok(res, data);
};

export const revocar = async (req, res) => {
  const data = await svc.revocar(req.params.id, req.user.firmaId, req.user);
  ok(res, data);
};

export const proximosAVencer = async (req, res) => {
  const dias = Number(req.query.dias) || 30;
  const data = await svc.proximosAVencer(req.user.firmaId, dias);
  ok(res, data);
};

export const vencidos = async (req, res) => {
  const data = await svc.vencidos(req.user.firmaId);
  ok(res, data);
};

export const resumen = async (req, res) => {
  const data = await svc.resumenFirma(req.user.firmaId);
  ok(res, data);
};
