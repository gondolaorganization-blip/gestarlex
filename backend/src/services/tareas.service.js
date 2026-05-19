import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { enviarEmail, templates } from './email.service.js';

export const listarPorCaso = async (casoId, firmaId, user) => {
  const caso = await prisma.caso.findFirst({ where: { id: casoId, firmaId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');

  const where = { casoId };
  // Pasante solo ve sus propias tareas
  if (user.rol === 'PASANTE') where.abogadoId = user.sub;

  return prisma.tarea.findMany({
    where,
    include: { abogado: { select: { id: true, nombre: true, rol: true } } },
    orderBy: [{ estado: 'asc' }, { prioridad: 'asc' }, { fechaLimite: 'asc' }],
  });
};

export const misTareas = async (firmaId, user) => {
  return prisma.tarea.findMany({
    where: {
      abogadoId: user.sub,
      estado: { not: 'COMPLETADA' },
      caso: { firmaId },
    },
    include: {
      caso: { select: { id: true, numero: true, titulo: true } },
    },
    orderBy: [{ prioridad: 'asc' }, { fechaLimite: 'asc' }],
  });
};

export const crear = async (casoId, datos, firmaId, user) => {
  const caso = await prisma.caso.findFirst({ where: { id: casoId, firmaId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');

  const abogadoId = datos.abogadoId || user.sub;
  const abogado = await prisma.abogado.findFirst({ where: { id: abogadoId, firmaId } });
  if (!abogado) throw new NotFoundError('Abogado no encontrado.');

  return prisma.tarea.create({
    data: {
      casoId,
      abogadoId,
      descripcion: datos.descripcion,
      fechaLimite: datos.fechaLimite ? new Date(datos.fechaLimite) : null,
      prioridad: datos.prioridad || 'MEDIA',
      estado: 'PENDIENTE',
      notas: datos.notas || null,
    },
    include: { abogado: { select: { id: true, nombre: true } } },
  });
};

export const actualizar = async (id, datos, firmaId, user) => {
  const tarea = await prisma.tarea.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!tarea) throw new NotFoundError('Tarea no encontrada.');
  if (tarea.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  if (user.rol === 'PASANTE' && tarea.abogadoId !== user.sub) {
    throw new ForbiddenError('Solo puedes editar tus propias tareas.');
  }

  return prisma.tarea.update({
    where: { id },
    data: {
      ...(datos.descripcion && { descripcion: datos.descripcion }),
      ...(datos.fechaLimite !== undefined && {
        fechaLimite: datos.fechaLimite ? new Date(datos.fechaLimite) : null,
      }),
      ...(datos.prioridad && { prioridad: datos.prioridad }),
      ...(datos.estado && { estado: datos.estado }),
      ...(datos.notas !== undefined && { notas: datos.notas }),
      ...(datos.estado === 'COMPLETADA' && { completadaEn: new Date() }),
    },
    include: { abogado: { select: { id: true, nombre: true } } },
  });
};

export const completar = async (id, firmaId, user) => {
  const tarea = await prisma.tarea.findFirst({
    where: { id },
    include: {
      caso: {
        select: {
          id: true, firmaId: true, numero: true, titulo: true,
          cliente: { select: { email: true } },
          firma: { select: { id: true, nombre: true } },
        },
      },
    },
  });
  if (!tarea) throw new NotFoundError('Tarea no encontrada.');
  if (tarea.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  if (user.rol === 'PASANTE' && tarea.abogadoId !== user.sub) {
    throw new ForbiddenError('Solo puedes completar tus propias tareas.');
  }

  const resultado = await prisma.tarea.update({
    where: { id },
    data: { estado: 'COMPLETADA', completadaEn: new Date() },
  });

  // Email al cliente si tiene dirección de correo
  const emailCliente = tarea.caso.cliente?.email;
  if (emailCliente) {
    const tmpl = templates.tareaCompletada({ caso: tarea.caso, tarea, firma: tarea.caso.firma });
    enviarEmail({
      firmaId,
      casoId: tarea.casoId,
      tipo: 'TAREA_COMPLETADA',
      asunto: tmpl.asunto,
      html: tmpl.html,
      destinatario: emailCliente,
    }).catch(() => {});
  }

  return resultado;
};

export const eliminar = async (id, firmaId, user) => {
  if (!['ADMIN', 'SOCIO'].includes(user.rol)) throw new ForbiddenError('Acceso denegado.');
  const tarea = await prisma.tarea.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!tarea) throw new NotFoundError('Tarea no encontrada.');
  if (tarea.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  await prisma.tarea.delete({ where: { id } });
};
