import { z } from 'zod';
import * as casosSvc from '../services/casos.service.js';
import * as tareasSvc from '../services/tareas.service.js';
import * as integracionesSvc from '../services/integraciones.service.js';
import * as apiKeysSvc from '../services/apiKeys.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const ESTADOS = ['ACTIVO', 'SUSPENDIDO', 'CERRADO', 'ARCHIVADO'];
const MAX_POR_PAGINA = 100;

const parsear = (schema, body, mensaje) => {
  const result = schema.safeParse(body);
  if (!result.success) throw new ValidationError(mensaje, result.error.flatten().fieldErrors);
  return result.data;
};

/**
 * Marca la nota con el nombre de la key que la originó, para que en el historial se
 * distinga lo escrito por una automatización de lo escrito desde la web.
 * El autor (abogadoId) ya queda registrado por el service; esto agrega el "por dónde".
 */
const conOrigen = (req, nota) => `[API: ${req.apiKey.nombre}] ${nota ?? ''}`.trimEnd();

// ─── SCHEMAS ──────────────────────────────────────────────────────────────────

const cambiarEstadoSchema = z.object({
  estado: z.enum(ESTADOS),
  nota: z.string().max(1000).optional(),
});

const actividadSchema = z.object({
  nota: z.string().min(3, 'La nota es requerida.').max(1000),
});

const pendienteSchema = z.object({
  descripcion: z.string().min(3, 'Descripción requerida.').max(500),
  fechaLimite: z.string().optional(),
  prioridad: z.enum(['ALTA', 'MEDIA', 'BAJA']).optional(),
  notas: z.string().max(1000).optional(),
  abogadoId: z.string().optional(),
});

const documentoSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido.').max(200),
  // Solo http/https: evita guardar file:// o javascript: que luego se renderizan como enlace
  url: z
    .string()
    .url('Debe ser una URL válida.')
    .refine((v) => /^https?:\/\//i.test(v), 'La URL debe empezar con http:// o https://'),
  tipo: z.string().max(60).optional(),
  descripcion: z.string().max(1000).optional(),
  confidencial: z.boolean().optional(),
});

const crearKeySchema = z.object({
  nombre: z.string().min(2, 'Ponle un nombre para saber cuál revocar después.').max(60),
  scopes: z.array(z.enum(apiKeysSvc.SCOPES_VALIDOS)).optional(),
  abogadoId: z.string().optional(),
  expiraEn: z.string().datetime({ offset: true }).optional(),
});

// ─── DIAGNÓSTICO ──────────────────────────────────────────────────────────────

export const ping = async (req, res) => {
  ok(res, {
    autenticado: true,
    key: req.apiKey.nombre,
    scopes: req.apiKey.scopes,
    actuaComo: { abogadoId: req.user.sub, nombre: req.user.nombre, rol: req.user.rol },
    firmaId: req.user.firmaId,
  });
};

// ─── LECTURA ──────────────────────────────────────────────────────────────────

export const listarCasos = async (req, res) => {
  // Por defecto solo los activos; ?estado=TODOS trae todos
  const estadoQuery = req.query.estado ?? 'ACTIVO';
  if (estadoQuery !== 'TODOS' && !ESTADOS.includes(estadoQuery)) {
    throw new ValidationError(`Estado inválido. Usa: ${ESTADOS.join(', ')} o TODOS.`);
  }

  const porPagina = Math.min(Number(req.query.porPagina) || 20, MAX_POR_PAGINA);

  const data = await casosSvc.listar(req.user.firmaId, req.user, {
    estado: estadoQuery === 'TODOS' ? undefined : estadoQuery,
    tipo: req.query.tipo || undefined,
    busqueda: req.query.busqueda || undefined,
    clienteId: req.query.clienteId || undefined,
    pagina: Number(req.query.pagina) || 1,
    porPagina,
    ordenPor: 'updatedAt',
    direccion: 'desc',
  });

  ok(res, data);
};

export const obtenerCaso = async (req, res) => {
  const data = await casosSvc.obtener(req.params.id, req.user);
  ok(res, data);
};

export const timelineCaso = async (req, res) => {
  const data = await casosSvc.timeline(req.params.id, req.user);
  ok(res, data);
};

export const listarPendientes = async (req, res) => {
  const data = await tareasSvc.todasPendientes(req.user.firmaId, req.user, {
    abogadoId: req.query.abogadoId || undefined,
    prioridad: req.query.prioridad || undefined,
  });
  ok(res, data);
};

// ─── ACTUALIZACIÓN ────────────────────────────────────────────────────────────

export const cambiarEstado = async (req, res) => {
  const datos = parsear(cambiarEstadoSchema, req.body, 'Estado inválido.');
  const data = await casosSvc.cambiarEstado(
    req.params.id,
    datos.estado,
    conOrigen(req, datos.nota),
    req.user,
  );
  ok(res, data);
};

export const registrarActividad = async (req, res) => {
  const datos = parsear(actividadSchema, req.body, 'Nota de actividad inválida.');
  const data = await integracionesSvc.registrarActividad(
    req.params.id,
    conOrigen(req, datos.nota),
    req.user.firmaId,
    req.user,
  );
  created(res, data);
};

export const crearPendiente = async (req, res) => {
  const datos = parsear(pendienteSchema, req.body, 'Datos del pendiente inválidos.');
  const data = await tareasSvc.crear(req.params.id, datos, req.user.firmaId, req.user);
  created(res, data);
};

export const referenciarDocumento = async (req, res) => {
  const datos = parsear(documentoSchema, req.body, 'Datos del documento inválidos.');
  const data = await integracionesSvc.referenciarDocumento(
    req.params.id,
    datos,
    req.user.firmaId,
    req.user,
  );
  created(res, data);
};

// ─── GESTIÓN DE KEYS (con el login normal, no con API key) ────────────────────

export const crearKey = async (req, res) => {
  const datos = parsear(crearKeySchema, req.body, 'Datos de la API key inválidos.');
  const data = await apiKeysSvc.crear(req.user.firmaId, datos, req.user);
  created(res, {
    ...data,
    aviso: 'Guarda "valor" ahora: es la única vez que se muestra.',
  });
};

export const listarKeys = async (req, res) => {
  const data = await apiKeysSvc.listar(req.user.firmaId);
  ok(res, data);
};

export const revocarKey = async (req, res) => {
  const data = await apiKeysSvc.revocar(req.params.id, req.user.firmaId);
  ok(res, data);
};
