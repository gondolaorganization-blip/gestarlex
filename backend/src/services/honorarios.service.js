import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

// ─── VERIFICACIÓN ─────────────────────────────────────────────────────────────

const verificarCaso = async (casoId, firmaId) => {
  const caso = await prisma.caso.findFirst({ where: { id: casoId, firmaId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  return caso;
};

// ─── HONORARIO CONFIG ─────────────────────────────────────────────────────────

export const obtenerConfig = async (casoId, firmaId) => {
  await verificarCaso(casoId, firmaId);
  const config = await prisma.honorarioConfig.findUnique({ where: { casoId } });
  if (!config) throw new NotFoundError('Configuración de honorarios no encontrada para este caso.');
  return config;
};

export const upsertConfig = async (casoId, datos, firmaId, user) => {
  if (user.rol === 'PASANTE') throw new ForbiddenError('Acceso denegado.');
  await verificarCaso(casoId, firmaId);

  return prisma.honorarioConfig.upsert({
    where: { casoId },
    create: {
      casoId,
      tipo: datos.tipo,
      tarifaHora: datos.tarifaHora ?? null,
      montoFijo: datos.montoFijo ?? null,
      porcentajeExito: datos.porcentajeExito ?? null,
      descripcion: datos.descripcion ?? null,
    },
    update: {
      tipo: datos.tipo,
      tarifaHora: datos.tarifaHora ?? null,
      montoFijo: datos.montoFijo ?? null,
      porcentajeExito: datos.porcentajeExito ?? null,
      descripcion: datos.descripcion ?? null,
    },
  });
};

// ─── REGISTRO DE HORAS ────────────────────────────────────────────────────────

export const listarHorasPorCaso = async (casoId, firmaId) => {
  await verificarCaso(casoId, firmaId);

  const registros = await prisma.registroHoras.findMany({
    where: { casoId },
    include: { abogado: { select: { id: true, nombre: true, rol: true } } },
    orderBy: { fecha: 'desc' },
  });

  const totales = registros.reduce(
    (acc, r) => {
      const h = Number(r.horas);
      acc.total += h;
      if (r.facturable && !r.facturaId) acc.pendienteFacturar += h;
      if (r.facturaId) acc.facturadas += h;
      return acc;
    },
    { total: 0, pendienteFacturar: 0, facturadas: 0 }
  );

  return { registros, totales };
};

export const listarHorasPorAbogado = async (abogadoId, firmaId, filtros = {}) => {
  const { desde, hasta, casoId, soloFacturables } = filtros;

  // Verificar que el abogado pertenece a la firma
  const abogado = await prisma.abogado.findFirst({ where: { id: abogadoId, firmaId } });
  if (!abogado) throw new NotFoundError('Abogado no encontrado.');

  const where = {
    abogadoId,
    caso: { firmaId },
  };
  if (casoId) where.casoId = casoId;
  if (soloFacturables === 'true') where.facturable = true;
  if (desde || hasta) {
    where.fecha = {};
    if (desde) where.fecha.gte = new Date(desde);
    if (hasta) where.fecha.lte = new Date(hasta);
  }

  const registros = await prisma.registroHoras.findMany({
    where,
    include: {
      caso: { select: { id: true, numero: true, titulo: true, tipo: true } },
    },
    orderBy: { fecha: 'desc' },
  });

  const totales = registros.reduce(
    (acc, r) => {
      const h = Number(r.horas);
      acc.total += h;
      if (r.facturable) acc.facturables += h;
      return acc;
    },
    { total: 0, facturables: 0 }
  );

  return { registros, totales, abogado: { id: abogado.id, nombre: abogado.nombre } };
};

export const registrarHoras = async (casoId, datos, firmaId, user) => {
  await verificarCaso(casoId, firmaId);

  // Verificar que el abogado pertenece a la firma
  const abogadoId = datos.abogadoId || user.sub;
  const abogado = await prisma.abogado.findFirst({ where: { id: abogadoId, firmaId } });
  if (!abogado) throw new NotFoundError('Abogado no encontrado en esta firma.');

  if (Number(datos.horas) <= 0) throw new ValidationError('Las horas deben ser mayor a cero.');

  return prisma.registroHoras.create({
    data: {
      casoId,
      abogadoId,
      fecha: datos.fecha ? new Date(datos.fecha) : new Date(),
      horas: datos.horas,
      descripcion: datos.descripcion,
      facturable: datos.facturable !== false && datos.facturable !== 'false',
    },
    include: {
      abogado: { select: { id: true, nombre: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
  });
};

export const actualizarHoras = async (id, datos, firmaId, user) => {
  const registro = await prisma.registroHoras.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!registro) throw new NotFoundError('Registro no encontrado.');
  if (registro.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  if (registro.facturaId) throw new ValidationError('No se puede editar un registro ya facturado.');
  if (user.rol === 'PASANTE' && registro.abogadoId !== user.sub) {
    throw new ForbiddenError('Solo puedes editar tus propios registros.');
  }

  return prisma.registroHoras.update({
    where: { id },
    data: {
      ...(datos.fecha && { fecha: new Date(datos.fecha) }),
      ...(datos.horas && { horas: datos.horas }),
      ...(datos.descripcion && { descripcion: datos.descripcion }),
      ...(datos.facturable !== undefined && { facturable: datos.facturable }),
    },
  });
};

export const eliminarHoras = async (id, firmaId, user) => {
  const registro = await prisma.registroHoras.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!registro) throw new NotFoundError('Registro no encontrado.');
  if (registro.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  if (registro.facturaId) throw new ValidationError('No se puede eliminar un registro ya facturado.');
  if (user.rol === 'PASANTE' && registro.abogadoId !== user.sub) {
    throw new ForbiddenError('Solo puedes eliminar tus propios registros.');
  }

  await prisma.registroHoras.delete({ where: { id } });
};

// ─── RESUMEN DE HORAS DE LA FIRMA ─────────────────────────────────────────────

export const resumenHorasFirma = async (firmaId, mes, anio) => {
  const inicio = new Date(anio, mes - 1, 1);
  const fin = new Date(anio, mes, 0, 23, 59, 59);

  const registros = await prisma.registroHoras.findMany({
    where: {
      fecha: { gte: inicio, lte: fin },
      caso: { firmaId },
    },
    include: {
      abogado: { select: { id: true, nombre: true, rol: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
  });

  // Agrupar por abogado
  const porAbogado = {};
  for (const r of registros) {
    const key = r.abogadoId;
    if (!porAbogado[key]) {
      porAbogado[key] = {
        abogado: r.abogado,
        total: 0,
        facturables: 0,
        noFacturables: 0,
        pendienteFacturar: 0,
      };
    }
    const h = Number(r.horas);
    porAbogado[key].total += h;
    if (r.facturable) {
      porAbogado[key].facturables += h;
      if (!r.facturaId) porAbogado[key].pendienteFacturar += h;
    } else {
      porAbogado[key].noFacturables += h;
    }
  }

  const totales = {
    total: registros.reduce((s, r) => s + Number(r.horas), 0),
    facturables: registros.filter((r) => r.facturable).reduce((s, r) => s + Number(r.horas), 0),
    pendienteFacturar: registros
      .filter((r) => r.facturable && !r.facturaId)
      .reduce((s, r) => s + Number(r.horas), 0),
  };

  return { mes, anio, totales, porAbogado: Object.values(porAbogado) };
};
