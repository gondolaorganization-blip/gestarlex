import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export const listar = async (firmaId, filtros = {}) => {
  const { tipo, busqueda, activo, pagina = 1, porPagina = 20 } = filtros;

  const where = { firmaId };
  if (tipo) where.tipo = tipo;
  if (activo !== undefined) where.activo = activo === 'true';
  if (busqueda) {
    where.OR = [
      { nombre: { contains: busqueda, mode: 'insensitive' } },
      { cedula: { contains: busqueda, mode: 'insensitive' } },
      { ruc: { contains: busqueda, mode: 'insensitive' } },
      { email: { contains: busqueda, mode: 'insensitive' } },
    ];
  }

  const skip = (Number(pagina) - 1) * Number(porPagina);

  const [total, clientes] = await Promise.all([
    prisma.cliente.count({ where }),
    prisma.cliente.findMany({
      where,
      select: {
        id: true, nombre: true, cedula: true, ruc: true, email: true,
        telefono: true, tipo: true, origen: true, activo: true, createdAt: true,
        _count: { select: { casos: true } },
      },
      orderBy: { nombre: 'asc' },
      skip,
      take: Number(porPagina),
    }),
  ]);

  return {
    datos: clientes,
    paginacion: { total, pagina: Number(pagina), porPagina: Number(porPagina), totalPaginas: Math.ceil(total / Number(porPagina)) },
  };
};

export const obtener = async (id, firmaId) => {
  const cliente = await prisma.cliente.findFirst({
    where: { id, firmaId },
    include: {
      casos: {
        select: {
          id: true, numero: true, titulo: true, tipo: true, estado: true,
          fechaApertura: true, abogado: { select: { nombre: true } },
        },
        orderBy: { fechaApertura: 'desc' },
      },
      poderes: { orderBy: { fechaOtorgamiento: 'desc' } },
      _count: { select: { casos: true, comunicaciones: true } },
    },
  });
  if (!cliente) throw new NotFoundError('Cliente no encontrado.');
  return cliente;
};

export const crear = async (firmaId, datos, rolSolicitante) => {
  if (rolSolicitante === 'PASANTE') {
    throw new ForbiddenError('Los pasantes no pueden crear clientes.');
  }
  return prisma.cliente.create({
    data: {
      firmaId,
      nombre: datos.nombre,
      cedula: datos.cedula,
      ruc: datos.ruc,
      email: datos.email,
      telefono: datos.telefono,
      tipo: datos.tipo || 'PERSONA_NATURAL',
      origen: datos.origen,
      notas: datos.notas,
    },
  });
};

export const actualizar = async (id, firmaId, datos, rolSolicitante) => {
  if (rolSolicitante === 'PASANTE') throw new ForbiddenError('Acceso denegado.');
  const cliente = await prisma.cliente.findFirst({ where: { id, firmaId } });
  if (!cliente) throw new NotFoundError('Cliente no encontrado.');

  return prisma.cliente.update({
    where: { id },
    data: {
      ...(datos.nombre && { nombre: datos.nombre }),
      ...(datos.cedula !== undefined && { cedula: datos.cedula }),
      ...(datos.ruc !== undefined && { ruc: datos.ruc }),
      ...(datos.email !== undefined && { email: datos.email }),
      ...(datos.telefono !== undefined && { telefono: datos.telefono }),
      ...(datos.tipo && { tipo: datos.tipo }),
      ...(datos.origen !== undefined && { origen: datos.origen }),
      ...(datos.notas !== undefined && { notas: datos.notas }),
      ...(datos.activo !== undefined && { activo: datos.activo }),
    },
  });
};
