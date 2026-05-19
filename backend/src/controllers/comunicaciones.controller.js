import { z } from 'zod';
import * as svc from '../services/comunicaciones.service.js';
import { getLogsPorCaso, enviarEmail, templates } from '../services/email.service.js';
import prisma from '../lib/prisma.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const crearSchema = z.object({
  clienteId: z.string().min(1, 'Cliente requerido.'),
  casoId: z.string().optional(),
  tipo: z.enum(['EMAIL', 'LLAMADA', 'REUNION', 'WHATSAPP', 'CARTA']).optional(),
  descripcion: z.string().min(3, 'Descripción requerida.'),
  fecha: z.string().optional(),
  notas: z.string().optional(),
  abogadoId: z.string().optional(),
});

export const listarPorCaso = async (req, res) => {
  const data = await svc.listarPorCaso(req.params.casoId, req.user.firmaId);
  ok(res, data);
};

export const listarPorCliente = async (req, res) => {
  const data = await svc.listarPorCliente(req.params.clienteId, req.user.firmaId);
  ok(res, data);
};

export const crear = async (req, res) => {
  const result = crearSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.crear(result.data, req.user.firmaId, req.user);
  created(res, data);
};

export const actualizar = async (req, res) => {
  const data = await svc.actualizar(req.params.id, req.body, req.user.firmaId, req.user);
  ok(res, data);
};

export const eliminar = async (req, res) => {
  await svc.eliminar(req.params.id, req.user.firmaId, req.user);
  ok(res, { message: 'Comunicación eliminada.' });
};

export const emailLogsPorCaso = async (req, res) => {
  const data = await getLogsPorCaso(req.params.casoId, req.user.firmaId);
  ok(res, data);
};

const cotizacionSchema = z.object({
  destinatario: z.string().email('Email inválido.'),
  destinatarioNombre: z.string().optional(),
  referencia: z.string().optional(),
  notas: z.string().optional(),
  servicios: z.array(z.object({
    descripcion: z.string(),
    cantidad: z.number(),
    tarifa: z.number(),
  })).min(1, 'La cotización debe tener al menos un servicio.'),
  totales: z.object({
    subtotalH: z.number(),
    subtotalG: z.number(),
    ajuste: z.number(),
    total: z.number(),
  }),
});

export const enviarCotizacion = async (req, res) => {
  const result = cotizacionSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos inválidos.', result.error.flatten().fieldErrors);
  }

  const { destinatario, destinatarioNombre, referencia, notas, servicios, totales } = result.data;
  const { firmaId } = req.user;

  const firma = await prisma.firma.findUnique({ where: { id: firmaId }, select: { id: true, nombre: true } });

  const tmpl = templates.cotizacionEnviada({ referencia, servicios, totales, notas, firma, destinatarioNombre });

  const resultado = await enviarEmail({
    firmaId,
    casoId: null,
    tipo: 'COTIZACION_ENVIADA',
    asunto: tmpl.asunto,
    html: tmpl.html,
    destinatario,
  });

  ok(res, { enviado: resultado.enviado, motivo: resultado.motivo });
};
