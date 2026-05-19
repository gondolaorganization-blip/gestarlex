import { z } from 'zod';
import * as svc from '../services/clientes.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const crearSchema = z.object({
  nombre: z.string().min(2, 'Nombre requerido.'),
  tipo: z.enum(['PERSONA_NATURAL', 'JURIDICA']).optional(),
  cedula: z.string().optional(),
  ruc: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  telefono: z.string().optional(),
  origen: z.string().optional(),
  notas: z.string().optional(),
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
    throw new ValidationError('Datos del cliente inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.crear(req.user.firmaId, result.data, req.user.rol);
  created(res, data);
};

export const actualizar = async (req, res) => {
  const data = await svc.actualizar(req.params.id, req.user.firmaId, req.body, req.user.rol);
  ok(res, data);
};
