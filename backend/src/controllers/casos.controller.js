import { z } from 'zod';
import * as svc from '../services/casos.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const crearSchema = z.object({
  clienteId: z.string().min(1, 'Cliente requerido.'),
  abogadoId: z.string().min(1, 'Abogado responsable requerido.'),
  numero: z.string().min(1, 'Número de expediente requerido.'),
  titulo: z.string().min(3, 'Título requerido.'),
  tipo: z
    .enum(['CIVIL', 'PENAL', 'LABORAL', 'COMERCIAL', 'ADMINISTRATIVO', 'FAMILIAR', 'MARITIMO', 'OTRO'])
    .optional(),
  juzgado: z.string().optional(),
  juez: z.string().optional(),
  contraparte: z.string().optional(),
  descripcion: z.string().optional(),
  fechaApertura: z.string().optional(),
  honorario: z
    .object({
      tipo: z.enum(['HORA', 'FIJO', 'CONTINGENCIA', 'MIXTO']),
      tarifaHora: z.number().positive().optional(),
      montoFijo: z.number().positive().optional(),
      porcentajeExito: z.number().min(0).max(100).optional(),
      descripcion: z.string().optional(),
    })
    .optional(),
});

const cambiarEstadoSchema = z.object({
  estado: z.enum(['ACTIVO', 'SUSPENDIDO', 'CERRADO', 'ARCHIVADO']),
  nota: z.string().optional(),
});

export const listar = async (req, res) => {
  const data = await svc.listar(req.user.firmaId, req.user, req.query);
  ok(res, data);
};

export const kanban = async (req, res) => {
  const data = await svc.kanban(req.user.firmaId, req.user);
  ok(res, data);
};

export const obtener = async (req, res) => {
  const data = await svc.obtener(req.params.id, req.user);
  ok(res, data);
};

export const crear = async (req, res) => {
  const result = crearSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos del caso inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.crear(req.user.firmaId, result.data, req.user);
  created(res, data);
};

export const actualizar = async (req, res) => {
  const data = await svc.actualizar(req.params.id, req.body, req.user);
  ok(res, data);
};

export const cambiarEstado = async (req, res) => {
  const result = cambiarEstadoSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Estado inválido.', result.error.flatten().fieldErrors);
  }
  const data = await svc.cambiarEstado(req.params.id, result.data.estado, result.data.nota, req.user);
  ok(res, data);
};

export const asignarAbogado = async (req, res) => {
  const { abogadoId, rol } = req.body;
  if (!abogadoId) throw new ValidationError('abogadoId requerido.');
  const data = await svc.asignarAbogado(req.params.id, abogadoId, rol, req.user);
  ok(res, data);
};

export const removerAbogado = async (req, res) => {
  await svc.removerAbogado(req.params.id, req.params.abogadoId, req.user);
  ok(res, { message: 'Abogado removido del caso.' });
};

export const timeline = async (req, res) => {
  const data = await svc.timeline(req.params.id, req.user);
  ok(res, data);
};

export const estadisticas = async (req, res) => {
  const data = await svc.estadisticas(req.params.id, req.user);
  ok(res, data);
};
