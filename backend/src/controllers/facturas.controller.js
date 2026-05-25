import { z } from 'zod';
import * as svc from '../services/facturas.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const crearSchema = z.object({
  clienteId: z.string().min(1, 'Cliente requerido.'),
  casoId: z.string().optional(),
  monto: z.number().positive('El monto debe ser mayor a 0.'),
  vence: z.string().optional(),
  notas: z.string().optional(),
});

const actualizarSchema = z.object({
  clienteId: z.string().optional(),
  monto: z.number().positive().optional(),
  vence: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
  destinatariosAdicionales: z.array(z.object({
    nombre: z.string(),
    documento: z.string().optional(),
    tipoDoc: z.string().optional(),
  })).nullable().optional(),
});

const estadoSchema = z.object({
  estado: z.enum(['ENVIADA', 'PAGADA', 'VENCIDA', 'ANULADA']),
});

export const listar = async (req, res) => {
  const data = await svc.listar(req.user.firmaId, req.query);
  ok(res, data);
};

export const obtener = async (req, res) => {
  const data = await svc.obtener(req.params.id, req.user.firmaId);
  ok(res, data);
};

export const crear = async (req, res) => {
  const result = crearSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos de la factura inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.crear(result.data, req.user.firmaId, req.user);
  created(res, data);
};

export const generarDesdeCaso = async (req, res) => {
  const data = await svc.generarDesdeCaso(req.params.casoId, req.body, req.user.firmaId, req.user);
  created(res, data);
};

export const actualizar = async (req, res) => {
  const result = actualizarSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.actualizar(req.params.id, result.data, req.user.firmaId, req.user);
  ok(res, data);
};

export const cambiarEstado = async (req, res) => {
  const result = estadoSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Estado inválido.', result.error.flatten().fieldErrors);
  }
  const data = await svc.cambiarEstado(req.params.id, result.data.estado, req.user.firmaId, req.user);
  ok(res, data);
};

export const agingReport = async (req, res) => {
  const data = await svc.agingReport(req.user.firmaId);
  ok(res, data);
};
