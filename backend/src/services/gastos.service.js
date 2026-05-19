import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

const verificarCaso = async (casoId, firmaId) => {
  const caso = await prisma.caso.findFirst({ where: { id: casoId, firmaId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  return caso;
};

export const listarPorCaso = async (casoId, firmaId) => {
  await verificarCaso(casoId, firmaId);

  const gastos = await prisma.gasto.findMany({
    where: { casoId },
    orderBy: { fecha: 'desc' },
  });

  const totales = gastos.reduce(
    (acc, g) => {
      const m = Number(g.monto);
      acc.total += m;
      if (g.reembolsable && !g.reembolsado) acc.pendienteReembolso += m;
      return acc;
    },
    { total: 0, pendienteReembolso: 0 }
  );

  return { gastos, totales };
};

export const listarFirma = async (firmaId, filtros = {}) => {
  const { tipo, reembolsable, reembolsado, desde, hasta, pagina = 1, porPagina = 20 } = filtros;

  const where = { caso: { firmaId } };
  if (tipo) where.tipo = tipo;
  if (reembolsable !== undefined) where.reembolsable = reembolsable === 'true';
  if (reembolsado !== undefined) where.reembolsado = reembolsado === 'true';
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = new Date(desde);
    if (hasta) where.fecha.lte = new Date(hasta);
  }

  const skip = (Number(pagina) - 1) * Number(porPagina);

  const [total, gastos, agregado] = await Promise.all([
    prisma.gasto.count({ where }),
    prisma.gasto.findMany({
      where,
      include: {
        caso: { select: { id: true, numero: true, titulo: true } },
      },
      orderBy: { fecha: 'desc' },
      skip,
      take: Number(porPagina),
    }),
    prisma.gasto.aggregate({
      where,
      _sum: { monto: true },
    }),
  ]);

  return {
    datos: gastos,
    paginacion: {
      total,
      pagina: Number(pagina),
      porPagina: Number(porPagina),
      totalPaginas: Math.ceil(total / Number(porPagina)),
    },
    totalMonto: Number(agregado._sum.monto || 0),
  };
};

export const crear = async (casoId, datos, firmaId, user) => {
  if (user.rol === 'PASANTE') throw new ForbiddenError('Los pasantes no pueden registrar gastos.');
  await verificarCaso(casoId, firmaId);

  return prisma.gasto.create({
    data: {
      casoId,
      descripcion: datos.descripcion,
      monto: datos.monto,
      tipo: datos.tipo || 'OTRO',
      fecha: datos.fecha ? new Date(datos.fecha) : new Date(),
      reembolsable: datos.reembolsable === true || datos.reembolsable === 'true',
      comprobante: datos.comprobante || null,
    },
  });
};

export const actualizar = async (id, datos, firmaId, user) => {
  if (user.rol === 'PASANTE') throw new ForbiddenError('Acceso denegado.');
  const gasto = await prisma.gasto.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!gasto) throw new NotFoundError('Gasto no encontrado.');
  if (gasto.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');

  return prisma.gasto.update({
    where: { id },
    data: {
      ...(datos.descripcion && { descripcion: datos.descripcion }),
      ...(datos.monto !== undefined && { monto: datos.monto }),
      ...(datos.tipo && { tipo: datos.tipo }),
      ...(datos.fecha && { fecha: new Date(datos.fecha) }),
      ...(datos.reembolsable !== undefined && { reembolsable: datos.reembolsable }),
      ...(datos.reembolsado !== undefined && { reembolsado: datos.reembolsado }),
      ...(datos.comprobante !== undefined && { comprobante: datos.comprobante }),
    },
  });
};

export const marcarReembolsado = async (id, firmaId, user) => {
  if (!['ADMIN', 'SOCIO'].includes(user.rol)) throw new ForbiddenError('Acceso denegado.');
  const gasto = await prisma.gasto.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!gasto) throw new NotFoundError('Gasto no encontrado.');
  if (gasto.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');

  return prisma.gasto.update({ where: { id }, data: { reembolsado: true } });
};

export const eliminar = async (id, firmaId, user) => {
  if (!['ADMIN', 'SOCIO'].includes(user.rol)) throw new ForbiddenError('Acceso denegado.');
  const gasto = await prisma.gasto.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!gasto) throw new NotFoundError('Gasto no encontrado.');
  if (gasto.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  await prisma.gasto.delete({ where: { id } });
};
