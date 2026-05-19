import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

const verificarCaso = async (casoId, firmaId) => {
  const caso = await prisma.caso.findFirst({ where: { id: casoId, firmaId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  return caso;
};

export const listarPorCaso = async (casoId, firmaId) => {
  await verificarCaso(casoId, firmaId);
  return prisma.comunicacion.findMany({
    where: { casoId },
    include: {
      abogado: { select: { id: true, nombre: true } },
      cliente: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'desc' },
  });
};

export const listarPorCliente = async (clienteId, firmaId) => {
  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, firmaId } });
  if (!cliente) throw new NotFoundError('Cliente no encontrado.');
  return prisma.comunicacion.findMany({
    where: { clienteId },
    include: {
      abogado: { select: { id: true, nombre: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
    orderBy: { fecha: 'desc' },
  });
};

export const crear = async (datos, firmaId, user) => {
  // Verificar cliente
  const cliente = await prisma.cliente.findFirst({ where: { id: datos.clienteId, firmaId } });
  if (!cliente) throw new NotFoundError('Cliente no encontrado.');

  // Verificar caso si se provee
  if (datos.casoId) await verificarCaso(datos.casoId, firmaId);

  return prisma.comunicacion.create({
    data: {
      casoId: datos.casoId || null,
      clienteId: datos.clienteId,
      abogadoId: datos.abogadoId || user.sub,
      tipo: datos.tipo || 'EMAIL',
      descripcion: datos.descripcion,
      fecha: datos.fecha ? new Date(datos.fecha) : new Date(),
      notas: datos.notas || null,
    },
    include: {
      abogado: { select: { id: true, nombre: true } },
      cliente: { select: { id: true, nombre: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
  });
};

export const actualizar = async (id, datos, firmaId, user) => {
  const com = await prisma.comunicacion.findFirst({
    where: { id },
    include: { cliente: { select: { firmaId: true } } },
  });
  if (!com) throw new NotFoundError('Comunicación no encontrada.');
  if (com.cliente.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');

  return prisma.comunicacion.update({
    where: { id },
    data: {
      ...(datos.tipo && { tipo: datos.tipo }),
      ...(datos.descripcion && { descripcion: datos.descripcion }),
      ...(datos.fecha && { fecha: new Date(datos.fecha) }),
      ...(datos.notas !== undefined && { notas: datos.notas }),
    },
  });
};

export const eliminar = async (id, firmaId, user) => {
  if (!['ADMIN', 'SOCIO'].includes(user.rol)) throw new ForbiddenError('Acceso denegado.');
  const com = await prisma.comunicacion.findFirst({
    where: { id },
    include: { cliente: { select: { firmaId: true } } },
  });
  if (!com) throw new NotFoundError('Comunicación no encontrada.');
  if (com.cliente.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  await prisma.comunicacion.delete({ where: { id } });
};
