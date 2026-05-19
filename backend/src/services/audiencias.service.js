import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { enviarEmail, templates } from './email.service.js';

const verificarAccesoCaso = async (casoId, firmaId) => {
  const caso = await prisma.caso.findFirst({ where: { id: casoId, firmaId } });
  if (!caso) throw new NotFoundError('Caso no encontrado o sin acceso.');
  return caso;
};

export const listarPorCaso = async (casoId, firmaId) => {
  await verificarAccesoCaso(casoId, firmaId);
  return prisma.audiencia.findMany({
    where: { casoId },
    orderBy: { fecha: 'asc' },
  });
};

export const obtener = async (id, firmaId) => {
  const audiencia = await prisma.audiencia.findFirst({
    where: { id },
    include: {
      caso: { select: { id: true, numero: true, titulo: true, firmaId: true } },
    },
  });
  if (!audiencia) throw new NotFoundError('Audiencia no encontrada.');
  if (audiencia.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  return audiencia;
};

export const crear = async (casoId, datos, firmaId, rolSolicitante) => {
  if (rolSolicitante === 'PASANTE') throw new ForbiddenError('Los pasantes no pueden crear audiencias.');
  await verificarAccesoCaso(casoId, firmaId);

  const audiencia = await prisma.audiencia.create({
    data: {
      casoId,
      titulo: datos.titulo,
      fecha: new Date(datos.fecha),
      hora: datos.hora,
      juzgado: datos.juzgado,
      sala: datos.sala,
      tipo: datos.tipo,
      notas: datos.notas,
      estado: 'PENDIENTE',
    },
  });

  // Email al cliente
  const caso = await prisma.caso.findUnique({
    where: { id: casoId },
    include: {
      cliente: { select: { email: true } },
      firma: { select: { id: true, nombre: true } },
    },
  });
  const emailCliente = caso?.cliente?.email;
  if (emailCliente) {
    const tmpl = templates.nuevaAudiencia({ caso, audiencia, firma: caso.firma });
    enviarEmail({
      firmaId,
      casoId,
      tipo: 'NUEVA_AUDIENCIA',
      asunto: tmpl.asunto,
      html: tmpl.html,
      destinatario: emailCliente,
    }).catch(() => {});
  }

  return audiencia;
};

export const actualizar = async (id, datos, firmaId, rolSolicitante) => {
  if (rolSolicitante === 'PASANTE') throw new ForbiddenError('Acceso denegado.');
  const audiencia = await prisma.audiencia.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!audiencia) throw new NotFoundError('Audiencia no encontrada.');
  if (audiencia.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');

  return prisma.audiencia.update({
    where: { id },
    data: {
      ...(datos.titulo && { titulo: datos.titulo }),
      ...(datos.fecha && { fecha: new Date(datos.fecha) }),
      ...(datos.hora !== undefined && { hora: datos.hora }),
      ...(datos.juzgado !== undefined && { juzgado: datos.juzgado }),
      ...(datos.sala !== undefined && { sala: datos.sala }),
      ...(datos.tipo !== undefined && { tipo: datos.tipo }),
      ...(datos.estado && { estado: datos.estado }),
      ...(datos.resultado !== undefined && { resultado: datos.resultado }),
      ...(datos.notas !== undefined && { notas: datos.notas }),
    },
  });
};

export const eliminar = async (id, firmaId, rolSolicitante) => {
  if (!['ADMIN', 'SOCIO'].includes(rolSolicitante)) throw new ForbiddenError('Acceso denegado.');
  const audiencia = await prisma.audiencia.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!audiencia) throw new NotFoundError('Audiencia no encontrada.');
  if (audiencia.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  await prisma.audiencia.delete({ where: { id } });
};

// Próximas audiencias de la firma — para dashboard y alertas
export const proximas = async (firmaId, dias = 7) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + dias);

  return prisma.audiencia.findMany({
    where: {
      estado: 'PENDIENTE',
      fecha: { gte: hoy, lte: limite },
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
    orderBy: { fecha: 'asc' },
  });
};

// Audiencias con alertas: marca cuántos días faltan y nivel de urgencia
export const conAlertas = async (firmaId) => {
  const audiencias = await proximas(firmaId, 7);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return audiencias.map((a) => {
    const diasRestantes = Math.ceil((new Date(a.fecha) - hoy) / (1000 * 60 * 60 * 24));
    return {
      ...a,
      diasRestantes,
      alerta: diasRestantes <= 1 ? 'CRITICA' : diasRestantes <= 3 ? 'ALTA' : 'MEDIA',
    };
  });
};
