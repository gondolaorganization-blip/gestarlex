import { z } from 'zod';
import * as adminService from '../services/admin.service.js';
import { ok } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const suscripcionSchema = z.object({
  suscripcionEstado: z.enum(['TRIAL', 'ACTIVO', 'SUSPENDIDO', 'VENCIDO']).optional(),
  trialEndsAt: z.string().datetime({ offset: true }).nullable().optional(),
  suscripcionVenceEn: z.string().datetime({ offset: true }).nullable().optional(),
  accessManual: z.boolean().optional(),
  plan: z.enum(['SOLO', 'FIRMA', 'ENTERPRISE']).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'Se requiere al menos un campo.' });

export const login = async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) throw new ValidationError('Datos inválidos.', result.error.flatten().fieldErrors);

  const datos = await adminService.login(result.data.email, result.data.password);
  ok(res, datos);
};

export const me = async (req, res) => {
  ok(res, req.admin);
};

export const listarFirmas = async (req, res) => {
  const { page, limit, busqueda, estado } = req.query;
  const datos = await adminService.listarFirmas({
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 20,
    busqueda,
    estado,
  });
  ok(res, datos);
};

export const obtenerFirma = async (req, res) => {
  const firma = await adminService.obtenerFirma(req.params.id);
  ok(res, firma);
};

export const actualizarSuscripcion = async (req, res) => {
  const result = suscripcionSchema.safeParse(req.body);
  if (!result.success) throw new ValidationError('Datos inválidos.', result.error.flatten().fieldErrors);

  const firma = await adminService.actualizarSuscripcion(req.params.id, result.data, req.admin.sub);
  ok(res, firma);
};

export const listarEventos = async (req, res) => {
  const eventos = await adminService.listarEventos(req.params.id);
  ok(res, eventos);
};
