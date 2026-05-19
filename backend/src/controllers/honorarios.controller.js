import { z } from 'zod';
import * as svc from '../services/honorarios.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const configSchema = z.object({
  tipo: z.enum(['HORA', 'FIJO', 'CONTINGENCIA', 'MIXTO']),
  tarifaHora: z.number().positive().optional().nullable(),
  montoFijo: z.number().positive().optional().nullable(),
  porcentajeExito: z.number().min(0).max(100).optional().nullable(),
  descripcion: z.string().optional().nullable(),
});

const horasSchema = z.object({
  horas: z.number().positive('Las horas deben ser mayor a 0.'),
  descripcion: z.string().min(3, 'Descripción requerida.'),
  fecha: z.string().optional(),
  facturable: z.boolean().optional(),
  abogadoId: z.string().optional(),
});

export const obtenerConfig = async (req, res) => {
  const data = await svc.obtenerConfig(req.params.casoId, req.user.firmaId);
  ok(res, data);
};

export const upsertConfig = async (req, res) => {
  const result = configSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Configuración inválida.', result.error.flatten().fieldErrors);
  }
  const data = await svc.upsertConfig(req.params.casoId, result.data, req.user.firmaId, req.user);
  ok(res, data);
};

export const listarHorasPorCaso = async (req, res) => {
  const data = await svc.listarHorasPorCaso(req.params.casoId, req.user.firmaId);
  ok(res, data);
};

export const listarHorasPorAbogado = async (req, res) => {
  const data = await svc.listarHorasPorAbogado(req.params.abogadoId, req.user.firmaId, req.query);
  ok(res, data);
};

export const registrarHoras = async (req, res) => {
  const result = horasSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos del registro inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.registrarHoras(req.params.casoId, result.data, req.user.firmaId, req.user);
  created(res, data);
};

export const actualizarHoras = async (req, res) => {
  const data = await svc.actualizarHoras(req.params.id, req.body, req.user.firmaId, req.user);
  ok(res, data);
};

export const eliminarHoras = async (req, res) => {
  await svc.eliminarHoras(req.params.id, req.user.firmaId, req.user);
  ok(res, { message: 'Registro eliminado.' });
};

export const resumenMensual = async (req, res) => {
  const mes = Number(req.query.mes) || new Date().getMonth() + 1;
  const anio = Number(req.query.anio) || new Date().getFullYear();
  const data = await svc.resumenHorasFirma(req.user.firmaId, mes, anio);
  ok(res, data);
};
