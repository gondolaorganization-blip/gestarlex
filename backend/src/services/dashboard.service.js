import prisma from '../lib/prisma.js';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const inicioMes = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const finMes = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
};

const enNDias = (n) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const f = new Date(d);
  f.setDate(f.getDate() + n);
  return f;
};

const hoyInicio = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const semaforo = (fechaVence, estado) => {
  if (estado === 'COMPLETADO') return 'COMPLETADO';
  const dias = Math.ceil((new Date(fechaVence) - hoyInicio()) / 86400000);
  if (dias < 0) return 'VENCIDO';
  if (dias === 0) return 'ROJO';
  if (dias <= 3) return 'NARANJA';
  if (dias <= 7) return 'AMARILLO';
  return 'VERDE';
};

// Filtro para que pasante solo vea sus casos
const filtroCasosPorRol = (firmaId, user) => {
  const base = { firmaId };
  if (user.rol === 'PASANTE') {
    return {
      ...base,
      OR: [{ abogadoId: user.sub }, { abogados: { some: { abogadoId: user.sub } } }],
    };
  }
  return base;
};

// ─── SECCIONES DEL DASHBOARD ──────────────────────────────────────────────────

const resumenGeneral = async (firmaId, user) => {
  const filtroCasos = filtroCasosPorRol(firmaId, user);

  const [casosActivos, casosEsMes, totalClientes, totalAbogados, timersActivos] =
    await Promise.all([
      prisma.caso.count({ where: { ...filtroCasos, estado: 'ACTIVO' } }),
      prisma.caso.count({
        where: { ...filtroCasos, fechaApertura: { gte: inicioMes() } },
      }),
      user.rol === 'PASANTE'
        ? Promise.resolve(null)
        : prisma.cliente.count({ where: { firmaId, activo: true } }),
      user.rol === 'PASANTE'
        ? Promise.resolve(null)
        : prisma.abogado.count({ where: { firmaId, activo: true } }),
      prisma.timer.count({
        where: { estado: 'CORRIENDO', caso: { firmaId } },
      }),
    ]);

  return { casosActivos, casosEsMes, totalClientes, totalAbogados, timersActivos };
};

const casosPorAbogado = async (firmaId, user) => {
  if (user.rol === 'PASANTE') return null;

  const abogados = await prisma.abogado.findMany({
    where: { firmaId, activo: true },
    select: { id: true, nombre: true, rol: true, avatarUrl: true },
  });

  const counts = await Promise.all(
    abogados.map((a) =>
      prisma.caso.count({ where: { firmaId, abogadoId: a.id, estado: 'ACTIVO' } })
    )
  );

  const horasMes = await Promise.all(
    abogados.map((a) =>
      prisma.registroHoras.aggregate({
        where: { abogadoId: a.id, caso: { firmaId }, fecha: { gte: inicioMes() } },
        _sum: { horas: true },
      })
    )
  );

  return abogados.map((a, i) => ({
    ...a,
    casosActivos: counts[i],
    horasMes: Number(horasMes[i]._sum.horas || 0),
  }));
};

const audienciasSemana = async (firmaId, user) => {
  const filtroCasos = filtroCasosPorRol(firmaId, user);
  const hoy = hoyInicio();
  const en7 = enNDias(7);

  const audiencias = await prisma.audiencia.findMany({
    where: {
      estado: 'PENDIENTE',
      fecha: { gte: hoy, lte: en7 },
      caso: filtroCasos,
    },
    include: {
      caso: {
        select: {
          id: true, numero: true, titulo: true,
          abogado: { select: { id: true, nombre: true } },
          cliente: { select: { nombre: true } },
        },
      },
    },
    orderBy: [{ fecha: 'asc' }, { hora: 'asc' }],
  });

  return audiencias.map((a) => {
    const dias = Math.ceil((new Date(a.fecha) - hoy) / 86400000);
    return {
      ...a,
      diasRestantes: dias,
      alerta: dias <= 1 ? 'CRITICA' : dias <= 3 ? 'ALTA' : 'MEDIA',
    };
  });
};

const terminosProximos = async (firmaId, user) => {
  const filtroCasos = filtroCasosPorRol(firmaId, user);

  // Auto-vencer términos pasados
  await prisma.terminoProcesal.updateMany({
    where: { estado: 'PENDIENTE', fechaVence: { lt: new Date() }, caso: filtroCasos },
    data: { estado: 'VENCIDO' },
  });

  const [proximos, vencidos] = await Promise.all([
    prisma.terminoProcesal.findMany({
      where: { estado: 'PENDIENTE', fechaVence: { gte: hoyInicio(), lte: enNDias(14) }, caso: filtroCasos },
      include: {
        caso: {
          select: {
            id: true, numero: true, titulo: true,
            abogado: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fechaVence: 'asc' },
      take: 10,
    }),
    prisma.terminoProcesal.count({ where: { estado: 'VENCIDO', caso: filtroCasos } }),
  ]);

  return {
    proximos: proximos.map((t) => ({
      ...t,
      diasRestantes: Math.ceil((new Date(t.fechaVence) - hoyInicio()) / 86400000),
      semaforo: semaforo(t.fechaVence, t.estado),
    })),
    totalVencidos: vencidos,
  };
};

const metricasFacturacion = async (firmaId, user) => {
  if (user.rol === 'PASANTE') return null;

  // Auto-vencer facturas
  await prisma.factura.updateMany({
    where: { firmaId, estado: 'ENVIADA', vence: { lt: new Date() } },
    data: { estado: 'VENCIDA' },
  });

  const [pendientes, cobradoMes, facturadoMes, porEstado] = await Promise.all([
    prisma.factura.findMany({
      where: { firmaId, estado: { in: ['ENVIADA', 'VENCIDA'] } },
      include: { cliente: { select: { nombre: true } } },
      orderBy: { vence: 'asc' },
      take: 8,
    }),
    prisma.factura.aggregate({
      where: { firmaId, estado: 'PAGADA', updatedAt: { gte: inicioMes() } },
      _sum: { monto: true },
    }),
    prisma.factura.aggregate({
      where: { firmaId, fecha: { gte: inicioMes() } },
      _sum: { monto: true },
    }),
    prisma.factura.groupBy({
      by: ['estado'],
      where: { firmaId },
      _sum: { monto: true },
      _count: { estado: true },
    }),
  ]);

  const totalPorCobrar = pendientes.reduce((s, f) => s + Number(f.monto), 0);
  const resumenEstados = porEstado.reduce((acc, e) => {
    acc[e.estado] = { count: e._count.estado, total: Number(e._sum.monto || 0) };
    return acc;
  }, {});

  return {
    pendientes: pendientes.map((f) => ({
      ...f,
      vencida: f.estado === 'VENCIDA',
      diasVencida: f.vence
        ? Math.max(0, Math.ceil((new Date() - new Date(f.vence)) / 86400000))
        : null,
    })),
    totalPorCobrar,
    cobradoMes: Number(cobradoMes._sum.monto || 0),
    facturadoMes: Number(facturadoMes._sum.monto || 0),
    resumenEstados,
  };
};

const horasMes = async (firmaId, user) => {
  const filtroAbogado =
    user.rol === 'PASANTE' ? { abogadoId: user.sub } : {};

  const [total, facturables, porAbogado, config] = await Promise.all([
    prisma.registroHoras.aggregate({
      where: { ...filtroAbogado, fecha: { gte: inicioMes(), lte: finMes() }, caso: { firmaId } },
      _sum: { horas: true },
    }),
    prisma.registroHoras.aggregate({
      where: {
        ...filtroAbogado,
        facturable: true,
        fecha: { gte: inicioMes(), lte: finMes() },
        caso: { firmaId },
      },
      _sum: { horas: true },
    }),
    user.rol === 'PASANTE'
      ? Promise.resolve([])
      : prisma.registroHoras.groupBy({
          by: ['abogadoId'],
          where: { fecha: { gte: inicioMes() }, caso: { firmaId } },
          _sum: { horas: true },
        }),
    // Tarifa promedio de los casos con config HORA o MIXTO
    user.rol !== 'PASANTE'
      ? prisma.honorarioConfig.aggregate({
          where: { tipo: { in: ['HORA', 'MIXTO'] }, caso: { firmaId } },
          _avg: { tarifaHora: true },
        })
      : Promise.resolve({ _avg: { tarifaHora: 0 } }),
  ]);

  const horasTotales = Number(total._sum.horas || 0);
  const horasFacturables = Number(facturables._sum.horas || 0);
  const tarifaPromedio = Number(config._avg.tarifaHora || 0);

  return {
    total: horasTotales,
    facturables: horasFacturables,
    noFacturables: horasTotales - horasFacturables,
    valorEstimado: horasFacturables * tarifaPromedio,
    tarifaPromedioFirma: tarifaPromedio,
    porAbogado,
  };
};

const alertasCriticas = async (firmaId, user) => {
  const filtroCasos = filtroCasosPorRol(firmaId, user);
  const hoy = hoyInicio();
  const manana = enNDias(1);
  const en7 = enNDias(7);

  const [
    audiencias24h,
    terminosVencidos,
    terminosHoy,
    poderesVencidos,
    facturasVencidas,
    timersAbandondados,
  ] = await Promise.all([
    // Audiencias en las próximas 24h
    prisma.audiencia.count({
      where: { estado: 'PENDIENTE', fecha: { gte: hoy, lte: manana }, caso: filtroCasos },
    }),
    // Términos vencidos sin atender
    prisma.terminoProcesal.count({ where: { estado: 'VENCIDO', caso: filtroCasos } }),
    // Términos que vencen hoy
    prisma.terminoProcesal.count({
      where: { estado: 'PENDIENTE', fechaVence: { gte: hoy, lte: manana }, caso: filtroCasos },
    }),
    // Poderes vencidos activos (sin revocar)
    user.rol === 'PASANTE'
      ? Promise.resolve(0)
      : prisma.poder.count({
          where: { activo: true, fechaVence: { lt: new Date() }, cliente: { firmaId } },
        }),
    // Facturas vencidas
    user.rol === 'PASANTE'
      ? Promise.resolve(0)
      : prisma.factura.count({ where: { firmaId, estado: 'VENCIDA' } }),
    // Timers corriendo hace más de 8h (posiblemente olvidados)
    prisma.timer.count({
      where: {
        estado: 'CORRIENDO',
        iniciadoEn: { lt: new Date(Date.now() - 8 * 60 * 60 * 1000) },
        caso: { firmaId },
      },
    }),
  ]);

  const total =
    audiencias24h + terminosVencidos + terminosHoy + poderesVencidos + facturasVencidas;

  return {
    total,
    items: [
      audiencias24h > 0 && {
        tipo: 'AUDIENCIA_HOY',
        nivel: 'CRITICA',
        mensaje: `${audiencias24h} audiencia${audiencias24h > 1 ? 's' : ''} en las próximas 24h`,
        count: audiencias24h,
        icono: 'gavel',
      },
      terminosHoy > 0 && {
        tipo: 'TERMINO_HOY',
        nivel: 'CRITICA',
        mensaje: `${terminosHoy} término${terminosHoy > 1 ? 's' : ''} que vence${terminosHoy > 1 ? 'n' : ''} hoy`,
        count: terminosHoy,
        icono: 'clock',
      },
      terminosVencidos > 0 && {
        tipo: 'TERMINO_VENCIDO',
        nivel: 'CRITICA',
        mensaje: `${terminosVencidos} término${terminosVencidos > 1 ? 's' : ''} vencido${terminosVencidos > 1 ? 's' : ''} sin atender`,
        count: terminosVencidos,
        icono: 'alert-triangle',
      },
      poderesVencidos > 0 && {
        tipo: 'PODER_VENCIDO',
        nivel: 'ALTA',
        mensaje: `${poderesVencidos} poder${poderesVencidos > 1 ? 'es' : ''} vencido${poderesVencidos > 1 ? 's' : ''}`,
        count: poderesVencidos,
        icono: 'file-x',
      },
      facturasVencidas > 0 && {
        tipo: 'FACTURA_VENCIDA',
        nivel: 'ALTA',
        mensaje: `${facturasVencidas} factura${facturasVencidas > 1 ? 's' : ''} vencida${facturasVencidas > 1 ? 's' : ''} sin cobrar`,
        count: facturasVencidas,
        icono: 'dollar-sign',
      },
      timersAbandondados > 0 && {
        tipo: 'TIMER_ABANDONADO',
        nivel: 'INFO',
        mensaje: `${timersAbandondados} timer${timersAbandondados > 1 ? 's' : ''} corriendo hace más de 8h`,
        count: timersAbandondados,
        icono: 'timer',
      },
    ].filter(Boolean),
  };
};

const actividadReciente = async (firmaId, user) => {
  const filtroCasos = filtroCasosPorRol(firmaId, user);

  const [casosRecientes, audienciasRecientes, documentosRecientes] = await Promise.all([
    prisma.caso.findMany({
      where: { ...filtroCasos, updatedAt: { gte: enNDias(-7) } },
      select: {
        id: true, numero: true, titulo: true, estado: true, updatedAt: true,
        abogado: { select: { nombre: true } },
        cliente: { select: { nombre: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.audiencia.findMany({
      where: { createdAt: { gte: enNDias(-7) }, caso: filtroCasos },
      select: {
        id: true, titulo: true, fecha: true, estado: true, createdAt: true,
        caso: { select: { id: true, numero: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.documento.findMany({
      where: { fechaSubida: { gte: enNDias(-7) }, caso: filtroCasos },
      select: {
        id: true, nombre: true, tipo: true, fechaSubida: true,
        caso: { select: { id: true, numero: true } },
        subidoPor: { select: { nombre: true } },
      },
      orderBy: { fechaSubida: 'desc' },
      take: 5,
    }),
  ]);

  // Mezclar y ordenar por fecha
  const eventos = [
    ...casosRecientes.map((c) => ({
      tipo: 'CASO', fecha: c.updatedAt, id: c.id,
      titulo: c.titulo, subtitulo: `Exp. ${c.numero}`,
      actor: c.abogado?.nombre, extra: c.estado,
    })),
    ...audienciasRecientes.map((a) => ({
      tipo: 'AUDIENCIA', fecha: a.createdAt, id: a.id,
      titulo: a.titulo, subtitulo: `Caso ${a.caso.numero}`,
      actor: null, extra: a.estado,
    })),
    ...documentosRecientes.map((d) => ({
      tipo: 'DOCUMENTO', fecha: d.fechaSubida, id: d.id,
      titulo: d.nombre, subtitulo: `Caso ${d.caso.numero}`,
      actor: d.subidoPor?.nombre, extra: d.tipo,
    })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 10);

  return eventos;
};

// ─── DASHBOARD PRINCIPAL ──────────────────────────────────────────────────────

export const obtenerDashboard = async (firmaId, user) => {
  const [
    resumen,
    porAbogado,
    audiencias,
    terminos,
    facturacion,
    horas,
    alertas,
    actividad,
  ] = await Promise.all([
    resumenGeneral(firmaId, user),
    casosPorAbogado(firmaId, user),
    audienciasSemana(firmaId, user),
    terminosProximos(firmaId, user),
    metricasFacturacion(firmaId, user),
    horasMes(firmaId, user),
    alertasCriticas(firmaId, user),
    actividadReciente(firmaId, user),
  ]);

  return {
    generadoEn: new Date().toISOString(),
    rol: user.rol,
    resumen,
    casosPorAbogado: porAbogado,
    audienciasSemana: audiencias,
    terminosProximos: terminos,
    facturacion,
    horasMes: horas,
    alertasCriticas: alertas,
    actividadReciente: actividad,
  };
};

// ─── MÉTRICAS RÁPIDAS (para widgets) ─────────────────────────────────────────

export const metricas = async (firmaId, user) => {
  const filtroCasos = filtroCasosPorRol(firmaId, user);

  const [casosActivos, audienciasHoy, terminosVencidos, porCobrar, horasFactMes] =
    await Promise.all([
      prisma.caso.count({ where: { ...filtroCasos, estado: 'ACTIVO' } }),
      prisma.audiencia.count({
        where: {
          estado: 'PENDIENTE',
          fecha: { gte: hoyInicio(), lte: enNDias(1) },
          caso: filtroCasos,
        },
      }),
      prisma.terminoProcesal.count({ where: { estado: 'VENCIDO', caso: filtroCasos } }),
      user.rol !== 'PASANTE'
        ? prisma.factura.aggregate({
            where: { firmaId, estado: { in: ['ENVIADA', 'VENCIDA'] } },
            _sum: { monto: true },
          })
        : Promise.resolve({ _sum: { monto: 0 } }),
      prisma.registroHoras.aggregate({
        where: {
          ...(user.rol === 'PASANTE' && { abogadoId: user.sub }),
          facturable: true,
          fecha: { gte: inicioMes() },
          caso: { firmaId },
        },
        _sum: { horas: true },
      }),
    ]);

  return {
    casosActivos,
    audienciasHoy,
    terminosVencidos,
    porCobrar: Number(porCobrar._sum.monto || 0),
    horasFacturablesMes: Number(horasFactMes._sum.horas || 0),
  };
};
