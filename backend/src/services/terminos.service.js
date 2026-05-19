import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { enviarEmail, templates } from './email.service.js';

// ─── SEMÁFORO ─────────────────────────────────────────────────────────────────
// Verde  > 7 días | Amarillo 4-7 días | Naranja 1-3 días | Rojo 0 días | Vencido pasado

const calcularSemaforo = (fechaVence, estado) => {
  if (estado === 'COMPLETADO') return { color: 'COMPLETADO', diasRestantes: null };

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fechaVence);
  vence.setHours(0, 0, 0, 0);
  const dias = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));

  if (dias < 0) return { color: 'VENCIDO', diasRestantes: dias };
  if (dias === 0) return { color: 'ROJO', diasRestantes: 0 };
  if (dias <= 3) return { color: 'NARANJA', diasRestantes: dias };
  if (dias <= 7) return { color: 'AMARILLO', diasRestantes: dias };
  return { color: 'VERDE', diasRestantes: dias };
};

// Auto-actualiza términos vencidos en la DB
const actualizarVencidos = async (firmaId) => {
  const hoy = new Date();
  await prisma.terminoProcesal.updateMany({
    where: {
      estado: 'PENDIENTE',
      fechaVence: { lt: hoy },
      caso: { firmaId },
    },
    data: { estado: 'VENCIDO' },
  });
};

const enriquecerTermino = (t) => ({
  ...t,
  semaforo: calcularSemaforo(t.fechaVence, t.estado),
});

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const listarPorCaso = async (casoId, firmaId) => {
  const caso = await prisma.caso.findFirst({ where: { id: casoId, firmaId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');

  await actualizarVencidos(firmaId);

  const terminos = await prisma.terminoProcesal.findMany({
    where: { casoId },
    orderBy: [{ estado: 'asc' }, { fechaVence: 'asc' }],
  });

  return terminos.map(enriquecerTermino);
};

export const obtener = async (id, firmaId) => {
  const termino = await prisma.terminoProcesal.findFirst({
    where: { id },
    include: {
      caso: { select: { id: true, numero: true, titulo: true, firmaId: true } },
    },
  });
  if (!termino) throw new NotFoundError('Término procesal no encontrado.');
  if (termino.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  return enriquecerTermino(termino);
};

export const crear = async (casoId, datos, firmaId, rolSolicitante) => {
  if (rolSolicitante === 'PASANTE') throw new ForbiddenError('Los pasantes no pueden crear términos procesales.');
  const caso = await prisma.caso.findFirst({
    where: { id: casoId, firmaId },
    include: {
      cliente: { select: { email: true } },
      firma: { select: { id: true, nombre: true } },
    },
  });
  if (!caso) throw new NotFoundError('Caso no encontrado.');

  const termino = await prisma.terminoProcesal.create({
    data: {
      casoId,
      descripcion: datos.descripcion,
      fechaVence: new Date(datos.fechaVence),
      diasAlerta: datos.diasAlerta ?? 3,
      prioridad: datos.prioridad || 'MEDIA',
      notas: datos.notas,
      estado: 'PENDIENTE',
    },
  });

  // Email al cliente
  const emailCliente = caso.cliente?.email;
  if (emailCliente) {
    const tmpl = templates.nuevoTermino({ caso, termino, firma: caso.firma });
    enviarEmail({
      firmaId,
      casoId,
      tipo: 'NUEVO_TERMINO',
      asunto: tmpl.asunto,
      html: tmpl.html,
      destinatario: emailCliente,
    }).catch(() => {});
  }

  return enriquecerTermino(termino);
};

export const actualizar = async (id, datos, firmaId, rolSolicitante) => {
  if (rolSolicitante === 'PASANTE') throw new ForbiddenError('Acceso denegado.');
  const termino = await prisma.terminoProcesal.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!termino) throw new NotFoundError('Término procesal no encontrado.');
  if (termino.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');

  const actualizado = await prisma.terminoProcesal.update({
    where: { id },
    data: {
      ...(datos.descripcion && { descripcion: datos.descripcion }),
      ...(datos.fechaVence && { fechaVence: new Date(datos.fechaVence) }),
      ...(datos.diasAlerta !== undefined && { diasAlerta: datos.diasAlerta }),
      ...(datos.prioridad && { prioridad: datos.prioridad }),
      ...(datos.notas !== undefined && { notas: datos.notas }),
    },
  });
  return enriquecerTermino(actualizado);
};

export const completar = async (id, firmaId) => {
  const termino = await prisma.terminoProcesal.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!termino) throw new NotFoundError('Término procesal no encontrado.');
  if (termino.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');

  const actualizado = await prisma.terminoProcesal.update({
    where: { id },
    data: { estado: 'COMPLETADO', completadoEn: new Date() },
  });
  return enriquecerTermino(actualizado);
};

export const eliminar = async (id, firmaId, rolSolicitante) => {
  if (!['ADMIN', 'SOCIO'].includes(rolSolicitante)) throw new ForbiddenError('Acceso denegado.');
  const termino = await prisma.terminoProcesal.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!termino) throw new NotFoundError('Término procesal no encontrado.');
  if (termino.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  await prisma.terminoProcesal.delete({ where: { id } });
};

// ─── ALERTAS Y VISTAS ─────────────────────────────────────────────────────────

// Términos próximos a vencer según diasAlerta de cada término
export const proximosAVencer = async (firmaId) => {
  await actualizarVencidos(firmaId);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Traer todos los PENDIENTES y filtrar en memoria según diasAlerta individual
  const pendientes = await prisma.terminoProcesal.findMany({
    where: {
      estado: 'PENDIENTE',
      caso: { firmaId },
    },
    include: {
      caso: {
        select: {
          id: true, numero: true, titulo: true,
          abogado: { select: { nombre: true } },
          cliente: { select: { nombre: true } },
        },
      },
    },
    orderBy: { fechaVence: 'asc' },
  });

  return pendientes
    .map((t) => {
      const diasRestantes = Math.ceil((new Date(t.fechaVence) - hoy) / (1000 * 60 * 60 * 24));
      return { ...t, semaforo: calcularSemaforo(t.fechaVence, t.estado), diasRestantes };
    })
    .filter((t) => t.diasRestantes <= t.diasAlerta);
};

export const vencidos = async (firmaId) => {
  await actualizarVencidos(firmaId);
  const terminos = await prisma.terminoProcesal.findMany({
    where: { estado: 'VENCIDO', caso: { firmaId } },
    include: {
      caso: { select: { id: true, numero: true, titulo: true } },
    },
    orderBy: { fechaVence: 'desc' },
  });
  return terminos.map(enriquecerTermino);
};
