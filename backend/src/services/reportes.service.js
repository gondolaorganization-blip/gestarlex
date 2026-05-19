import prisma from '../lib/prisma.js';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const parsePeriodo = (desde, hasta) => ({
  inicio: desde ? new Date(desde) : new Date(new Date().getFullYear(), 0, 1),
  fin: hasta ? new Date(hasta) : new Date(),
});

const fmt = (num, decimales = 2) =>
  Number(num || 0).toLocaleString('es-PA', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

// ─── REPORTE 1: PRODUCTIVIDAD POR ABOGADO ────────────────────────────────────

export const productividadAbogados = async (firmaId, filtros = {}) => {
  const { inicio, fin } = parsePeriodo(filtros.desde, filtros.hasta);

  const abogados = await prisma.abogado.findMany({
    where: { firmaId, activo: true },
    select: { id: true, nombre: true, rol: true, numeroIdoneidad: true, especialidad: true },
    orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
  });

  const datos = await Promise.all(
    abogados.map(async (a) => {
      const [horas, horasFact, casosActivos, casosCerrados, tareasComp, audienciasReal] =
        await Promise.all([
          prisma.registroHoras.aggregate({
            where: { abogadoId: a.id, fecha: { gte: inicio, lte: fin } },
            _sum: { horas: true },
          }),
          prisma.registroHoras.aggregate({
            where: { abogadoId: a.id, facturable: true, fecha: { gte: inicio, lte: fin } },
            _sum: { horas: true },
          }),
          prisma.caso.count({ where: { firmaId, abogadoId: a.id, estado: 'ACTIVO' } }),
          prisma.caso.count({
            where: { firmaId, abogadoId: a.id, estado: 'CERRADO', fechaCierre: { gte: inicio, lte: fin } },
          }),
          prisma.tarea.count({
            where: { abogadoId: a.id, estado: 'COMPLETADA', completadaEn: { gte: inicio, lte: fin } },
          }),
          prisma.audiencia.count({
            where: { estado: 'REALIZADA', caso: { firmaId, abogadoId: a.id }, fecha: { gte: inicio, lte: fin } },
          }),
        ]);

      const horasTotales = Number(horas._sum.horas || 0);
      const horasFacturables = Number(horasFact._sum.horas || 0);
      const eficiencia = horasTotales > 0 ? (horasFacturables / horasTotales) * 100 : 0;

      return {
        ...a,
        horas: { total: horasTotales, facturables: horasFacturables, noFacturables: horasTotales - horasFacturables, eficiencia: Math.round(eficiencia) },
        casos: { activos: casosActivos, cerrados: casosCerrados },
        tareas: { completadas: tareasComp },
        audiencias: { realizadas: audienciasReal },
      };
    })
  );

  return {
    titulo: 'Reporte de Productividad por Abogado',
    firma: await prisma.firma.findUnique({ where: { id: firmaId }, select: { nombre: true, ruc: true } }),
    periodo: { desde: inicio.toISOString().split('T')[0], hasta: fin.toISOString().split('T')[0] },
    datos,
    totales: {
      horasTotales: datos.reduce((s, a) => s + a.horas.total, 0),
      horasFacturables: datos.reduce((s, a) => s + a.horas.facturables, 0),
      casosCerrados: datos.reduce((s, a) => s + a.casos.cerrados, 0),
    },
  };
};

// ─── REPORTE 2: RENTABILIDAD POR CASO ────────────────────────────────────────

export const rentabilidadCasos = async (firmaId, filtros = {}) => {
  const { inicio, fin } = parsePeriodo(filtros.desde, filtros.hasta);

  const casos = await prisma.caso.findMany({
    where: { firmaId, fechaApertura: { gte: inicio, lte: fin } },
    include: {
      cliente: { select: { nombre: true } },
      abogado: { select: { nombre: true } },
      honorarioConfig: true,
    },
    orderBy: { fechaApertura: 'desc' },
  });

  const datos = await Promise.all(
    casos.map(async (c) => {
      const [horas, facturado, cobrado, gastos] = await Promise.all([
        prisma.registroHoras.aggregate({ where: { casoId: c.id }, _sum: { horas: true } }),
        prisma.factura.aggregate({ where: { casoId: c.id }, _sum: { monto: true } }),
        prisma.factura.aggregate({ where: { casoId: c.id, estado: 'PAGADA' }, _sum: { monto: true } }),
        prisma.gasto.aggregate({ where: { casoId: c.id }, _sum: { monto: true } }),
      ]);

      const horasTotales = Number(horas._sum.horas || 0);
      const montoFacturado = Number(facturado._sum.monto || 0);
      const montoCobrado = Number(cobrado._sum.monto || 0);
      const montoGastos = Number(gastos._sum.monto || 0);
      const tarifaHora = Number(c.honorarioConfig?.tarifaHora || 0);
      const margen = montoFacturado - montoGastos;

      return {
        id: c.id,
        numero: c.numero,
        titulo: c.titulo,
        tipo: c.tipo,
        estado: c.estado,
        cliente: c.cliente.nombre,
        abogado: c.abogado.nombre,
        fechaApertura: c.fechaApertura,
        fechaCierre: c.fechaCierre,
        horas: horasTotales,
        valorHoras: horasTotales * tarifaHora,
        facturado: montoFacturado,
        cobrado: montoCobrado,
        pendiente: montoFacturado - montoCobrado,
        gastos: montoGastos,
        margen,
        rentabilidad: montoFacturado > 0 ? Math.round((margen / montoFacturado) * 100) : 0,
      };
    })
  );

  datos.sort((a, b) => b.facturado - a.facturado);

  return {
    titulo: 'Reporte de Rentabilidad por Caso',
    firma: await prisma.firma.findUnique({ where: { id: firmaId }, select: { nombre: true, ruc: true } }),
    periodo: { desde: inicio.toISOString().split('T')[0], hasta: fin.toISOString().split('T')[0] },
    datos,
    totales: {
      facturado: datos.reduce((s, c) => s + c.facturado, 0),
      cobrado: datos.reduce((s, c) => s + c.cobrado, 0),
      gastos: datos.reduce((s, c) => s + c.gastos, 0),
      margen: datos.reduce((s, c) => s + c.margen, 0),
      horas: datos.reduce((s, c) => s + c.horas, 0),
    },
  };
};

// ─── REPORTE 3: RENTABILIDAD POR CLIENTE ─────────────────────────────────────

export const rentabilidadClientes = async (firmaId, filtros = {}) => {
  const { inicio, fin } = parsePeriodo(filtros.desde, filtros.hasta);

  const clientes = await prisma.cliente.findMany({
    where: { firmaId },
    include: { _count: { select: { casos: true } } },
    orderBy: { nombre: 'asc' },
  });

  const datos = await Promise.all(
    clientes.map(async (cl) => {
      const [casosActivos, facturado, cobrado, horas] = await Promise.all([
        prisma.caso.count({ where: { clienteId: cl.id, estado: 'ACTIVO' } }),
        prisma.factura.aggregate({
          where: { clienteId: cl.id, fecha: { gte: inicio, lte: fin } },
          _sum: { monto: true },
        }),
        prisma.factura.aggregate({
          where: { clienteId: cl.id, estado: 'PAGADA', updatedAt: { gte: inicio, lte: fin } },
          _sum: { monto: true },
        }),
        prisma.registroHoras.aggregate({
          where: { caso: { clienteId: cl.id }, fecha: { gte: inicio, lte: fin } },
          _sum: { horas: true },
        }),
      ]);

      return {
        id: cl.id,
        nombre: cl.nombre,
        tipo: cl.tipo,
        totalCasos: cl._count.casos,
        casosActivos,
        facturado: Number(facturado._sum.monto || 0),
        cobrado: Number(cobrado._sum.monto || 0),
        pendiente: Number(facturado._sum.monto || 0) - Number(cobrado._sum.monto || 0),
        horas: Number(horas._sum.horas || 0),
      };
    })
  );

  const datosFiltrados = datos.filter((c) => c.facturado > 0 || c.totalCasos > 0);
  datosFiltrados.sort((a, b) => b.facturado - a.facturado);

  return {
    titulo: 'Reporte de Rentabilidad por Cliente',
    firma: await prisma.firma.findUnique({ where: { id: firmaId }, select: { nombre: true, ruc: true } }),
    periodo: { desde: inicio.toISOString().split('T')[0], hasta: fin.toISOString().split('T')[0] },
    datos: datosFiltrados,
    totales: {
      facturado: datosFiltrados.reduce((s, c) => s + c.facturado, 0),
      cobrado: datosFiltrados.reduce((s, c) => s + c.cobrado, 0),
      pendiente: datosFiltrados.reduce((s, c) => s + c.pendiente, 0),
    },
  };
};

// ─── REPORTE 4: INGRESOS POR TIPO DE CASO ────────────────────────────────────

export const ingresosPorTipo = async (firmaId, filtros = {}) => {
  const { inicio, fin } = parsePeriodo(filtros.desde, filtros.hasta);

  const tipos = ['CIVIL', 'PENAL', 'LABORAL', 'COMERCIAL', 'ADMINISTRATIVO', 'FAMILIAR', 'MARITIMO', 'OTRO'];

  const datos = await Promise.all(
    tipos.map(async (tipo) => {
      const [count, facturado, cobrado, horas] = await Promise.all([
        prisma.caso.count({ where: { firmaId, tipo, fechaApertura: { gte: inicio, lte: fin } } }),
        prisma.factura.aggregate({
          where: { caso: { firmaId, tipo }, fecha: { gte: inicio, lte: fin } },
          _sum: { monto: true },
        }),
        prisma.factura.aggregate({
          where: { caso: { firmaId, tipo }, estado: 'PAGADA', updatedAt: { gte: inicio, lte: fin } },
          _sum: { monto: true },
        }),
        prisma.registroHoras.aggregate({
          where: { caso: { firmaId, tipo }, fecha: { gte: inicio, lte: fin } },
          _sum: { horas: true },
        }),
      ]);

      return {
        tipo,
        casos: count,
        facturado: Number(facturado._sum.monto || 0),
        cobrado: Number(cobrado._sum.monto || 0),
        horas: Number(horas._sum.horas || 0),
      };
    })
  );

  const datosFiltrados = datos.filter((t) => t.casos > 0);
  const totalFacturado = datosFiltrados.reduce((s, t) => s + t.facturado, 0);

  return {
    titulo: 'Reporte de Ingresos por Tipo de Caso',
    firma: await prisma.firma.findUnique({ where: { id: firmaId }, select: { nombre: true, ruc: true } }),
    periodo: { desde: inicio.toISOString().split('T')[0], hasta: fin.toISOString().split('T')[0] },
    datos: datosFiltrados
      .sort((a, b) => b.facturado - a.facturado)
      .map((t) => ({
        ...t,
        porcentaje: totalFacturado > 0 ? Math.round((t.facturado / totalFacturado) * 100) : 0,
      })),
    totales: {
      casos: datosFiltrados.reduce((s, t) => s + t.casos, 0),
      facturado: totalFacturado,
      cobrado: datosFiltrados.reduce((s, t) => s + t.cobrado, 0),
      horas: datosFiltrados.reduce((s, t) => s + t.horas, 0),
    },
  };
};

// ─── REPORTE 5: CASOS GANADOS VS CERRADOS ────────────────────────────────────

export const estadisticasCasos = async (firmaId, filtros = {}) => {
  const { inicio, fin } = parsePeriodo(filtros.desde, filtros.hasta);

  const [activos, cerrados, suspendidos, archivados, abiertos, porTipo] = await Promise.all([
    prisma.caso.count({ where: { firmaId, estado: 'ACTIVO' } }),
    prisma.caso.count({ where: { firmaId, estado: 'CERRADO', fechaCierre: { gte: inicio, lte: fin } } }),
    prisma.caso.count({ where: { firmaId, estado: 'SUSPENDIDO' } }),
    prisma.caso.count({ where: { firmaId, estado: 'ARCHIVADO' } }),
    prisma.caso.count({ where: { firmaId, fechaApertura: { gte: inicio, lte: fin } } }),
    prisma.caso.groupBy({
      by: ['tipo'],
      where: { firmaId },
      _count: { tipo: true },
    }),
  ]);

  // Duración promedio de casos cerrados
  const casosCerradosList = await prisma.caso.findMany({
    where: { firmaId, estado: 'CERRADO', fechaCierre: { not: null } },
    select: { fechaApertura: true, fechaCierre: true },
    take: 100,
  });

  const duraciones = casosCerradosList
    .filter((c) => c.fechaCierre)
    .map((c) => (new Date(c.fechaCierre) - new Date(c.fechaApertura)) / (1000 * 60 * 60 * 24));

  const duracionPromedio = duraciones.length
    ? Math.round(duraciones.reduce((s, d) => s + d, 0) / duraciones.length)
    : 0;

  return {
    titulo: 'Estadísticas de Casos',
    firma: await prisma.firma.findUnique({ where: { id: firmaId }, select: { nombre: true, ruc: true } }),
    periodo: { desde: inicio.toISOString().split('T')[0], hasta: fin.toISOString().split('T')[0] },
    datos: {
      porEstado: { activos, cerrados, suspendidos, archivados },
      abiertosEnPeriodo: abiertos,
      cerradosEnPeriodo: cerrados,
      duracionPromedioDias: duracionPromedio,
      porTipo: porTipo.map((t) => ({ tipo: t.tipo, count: t._count.tipo }))
        .sort((a, b) => b.count - a.count),
    },
  };
};

// ─── REPORTE 6: AGING DE HONORARIOS ──────────────────────────────────────────

export const agingHonorarios = async (firmaId) => {
  const hoy = new Date();

  await prisma.factura.updateMany({
    where: { firmaId, estado: 'ENVIADA', vence: { lt: hoy } },
    data: { estado: 'VENCIDA' },
  });

  const pendientes = await prisma.factura.findMany({
    where: { firmaId, estado: { in: ['ENVIADA', 'VENCIDA'] } },
    include: {
      cliente: { select: { id: true, nombre: true, email: true, telefono: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
    orderBy: { fecha: 'asc' },
  });

  const bucket = (f) => {
    if (!f.vence || new Date(f.vence) > hoy) return 'corriente';
    const dias = Math.ceil((hoy - new Date(f.vence)) / 86400000);
    if (dias <= 30) return '1-30';
    if (dias <= 60) return '31-60';
    if (dias <= 90) return '61-90';
    return 'mas90';
  };

  const buckets = { corriente: [], '1-30': [], '31-60': [], '61-90': [], mas90: [] };
  for (const f of pendientes) buckets[bucket(f)].push(f);

  const suma = (arr) => arr.reduce((s, f) => s + Number(f.monto), 0);

  return {
    titulo: 'Aging Report de Honorarios',
    firma: await prisma.firma.findUnique({ where: { id: firmaId }, select: { nombre: true, ruc: true } }),
    generadoEn: hoy.toISOString().split('T')[0],
    buckets,
    totales: {
      corriente: suma(buckets.corriente),
      '1-30': suma(buckets['1-30']),
      '31-60': suma(buckets['31-60']),
      '61-90': suma(buckets['61-90']),
      mas90: suma(buckets.mas90),
      total: pendientes.reduce((s, f) => s + Number(f.monto), 0),
    },
    totalFacturas: pendientes.length,
  };
};
