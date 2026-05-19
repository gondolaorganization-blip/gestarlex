import { z } from 'zod';
import * as svc from '../services/abogados.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const crearSchema = z.object({
  nombre: z.string().min(3, 'Nombre requerido.'),
  numeroIdoneidad: z.string().min(1, 'Número de idoneidad requerido.'),
  email: z.string().email('Email inválido.'),
  especialidad: z.string().optional(),
  telefono: z.string().optional(),
  rol: z.enum(['SOCIO', 'ASOCIADO', 'PASANTE', 'ADMIN']).optional(),
  password: z.string().min(8).optional(),
});

export const listar = async (req, res) => {
  const data = await svc.listar(req.user.firmaId);
  ok(res, data);
};

export const obtener = async (req, res) => {
  const data = await svc.obtener(req.params.id, req.user.firmaId);
  ok(res, data);
};

export const crear = async (req, res) => {
  const result = crearSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.crear(req.user.firmaId, result.data, req.user.rol);
  created(res, data);
};

export const actualizar = async (req, res) => {
  const data = await svc.actualizar(
    req.params.id,
    req.user.firmaId,
    req.body,
    req.user.rol,
    req.user.sub
  );
  ok(res, data);
};

export const desactivar = async (req, res) => {
  await svc.desactivar(req.params.id, req.user.firmaId, req.user.rol);
  ok(res, { message: 'Abogado desactivado.' });
};
