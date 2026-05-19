import prisma from '../lib/prisma.js';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const semaforo = (fechaVence, estado) => {
  if (estado === 'COMPLETADO') return 'COMPLETADO';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.ceil((new Date(fechaVence) - hoy) / (1000 * 60 * 60 * 24));
  if (dias < 0) return 'VENCIDO';
  if (dias === 0) return 'ROJO';
  if (dias <= 3) return 'NARANJA';
  if (dias <= 7) return 'AMARILLO';
  return 'VERDE';
};

const buildFiltroFirma = (firmaId, user) => {
  const base = { firmaId };
  if (user.rol === 'PASANTE') {
    return {
      ...base,
      OR: [
        { abogadoId: user.sub },
        { abogados: { some: { abogadoId: user.sub } } },
      ],
    };
  }
  return base;
};

// ─── VISTA MENSUAL ────────────────────────────────────────────────────────────

export const mensual = async (firmaId, user, year, month) => {
  const inicio = new Date(year, month - 1, 1);
  const fin = new Date(year, month, 0, 23, 59, 59);

  const filtroCaso = buildFiltroFirma(firmaId, user);

  const [audiencias, terminos] = await Promise.all([
    prisma.audiencia.findMany({
      where: {
        fecha: { gte: inicio, lte: fin },
        caso: filtroCaso,
      },
      select: {
        id: true, titulo: true, fecha: true, hora: true,
        juzgado: true, sala: true, tipo: true, estado: true,
        caso: {
          select: {
            id: true, numero: true, titulo: true,
            abogado: { select: { id: true, nombre: true } },
            cliente: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fecha: 'asc' },
    }),
    prisma.terminoProcesal.findMany({
      where: {
        fechaVence: { gte: inicio, lte: fin },
        caso: filtroCaso,
      },
      select: {
        id: true, descripcion: true, fechaVence: true,
        estado: true, prioridad: true, diasAlerta: true,
        caso: {
          select: {
            id: true, numero: true, titulo: true,
            abogado: { select: { id: true, nombre: true } },
            cliente: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fechaVence: 'asc' },
    }),
  ]);

  // Agrupar por día para facilitar el renderizado del calendario
  const dias = {};

  for (const a of audiencias) {
    const key = new Date(a.fecha).toISOString().split('T')[0];
    if (!dias[key]) dias[key] = { audiencias: [], terminos: [] };
    dias[key].audiencias.push({ ...a, tipoEvento: 'AUDIENCIA' });
  }

  for (const t of terminos) {
    const key = new Date(t.fechaVence).toISOString().split('T')[0];
    if (!dias[key]) dias[key] = { audiencias: [], terminos: [] };
    dias[key].terminos.push({
      ...t,
      tipoEvento: 'TERMINO',
      semaforo: semaforo(t.fechaVence, t.estado),
    });
  }

  return {
    year,
    month,
    totalAudiencias: audiencias.length,
    totalTerminos: terminos.length,
    dias,
  };
};

// ─── VISTA SEMANAL ────────────────────────────────────────────────────────────

export const semanal = async (firmaId, user, fechaRef) => {
  // Calcular lunes y domingo de la semana que contiene fechaRef
  const ref = fechaRef ? new Date(fechaRef) : new Date();
  const diaSemana = ref.getDay(); // 0=domingo
  const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(ref);
  lunes.setDate(ref.getDate() + diff);
  lunes.setHours(0, 0, 0, 0);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);

  const filtroCaso = buildFiltroFirma(firmaId, user);

  const [audiencias, terminos] = await Promise.all([
    prisma.audiencia.findMany({
      where: {
        fecha: { gte: lunes, lte: domingo },
        caso: filtroCaso,
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
    }),
    prisma.terminoProcesal.findMany({
      where: {
        fechaVence: { gte: lunes, lte: domingo },
        caso: filtroCaso,
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
      orderBy: { fechaVence: 'asc' },
    }),
  ]);

  // Agrupar por día de la semana (lun=0 ... dom=6)
  const semana = Array.from({ length: 7 }, (_, i) => {
    const fecha = new Date(lunes);
    fecha.setDate(lunes.getDate() + i);
    const key = fecha.toISOString().split('T')[0];
    return {
      fecha: key,
      diaSemana: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][i],
      audiencias: audiencias
        .filter((a) => new Date(a.fecha).toISOString().split('T')[0] === key)
        .map((a) => ({ ...a, tipoEvento: 'AUDIENCIA' })),
      terminos: terminos
        .filter((t) => new Date(t.fechaVence).toISOString().split('T')[0] === key)
        .map((t) => ({ ...t, tipoEvento: 'TERMINO', semaforo: semaforo(t.fechaVence, t.estado) })),
    };
  });

  return {
    semana,
    inicio: lunes.toISOString().split('T')[0],
    fin: domingo.toISOString().split('T')[0],
    totalAudiencias: audiencias.length,
    totalTerminos: terminos.length,
  };
};

// ─── ALERTAS CRÍTICAS ─────────────────────────────────────────────────────────

export const alertas = async (firmaId, user) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const en7dias = new Date(hoy);
  en7dias.setDate(hoy.getDate() + 7);

  const filtroCaso = buildFiltroFirma(firmaId, user);

  // Auto-vencer términos pasados
  await prisma.terminoProcesal.updateMany({
    where: {
      estado: 'PENDIENTE',
      fechaVence: { lt: hoy },
      caso: filtroCaso,
    },
    data: { estado: 'VENCIDO' },
  });

  const [audienciasUrgentes, terminosProximos, terminosVencidos] = await Promise.all([
    // Audiencias en los próximos 7 días
    prisma.audiencia.findMany({
      where: {
        estado: 'PENDIENTE',
        fecha: { gte: hoy, lte: en7dias },
        caso: filtroCaso,
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
    }),

    // Términos PENDIENTES en los próximos 7 días
    prisma.terminoProcesal.findMany({
      where: {
        estado: 'PENDIENTE',
        fechaVence: { gte: hoy, lte: en7dias },
        caso: filtroCaso,
      },
      include: {
        caso: {
          select: {
            id: true, numero: true, titulo: true,
            abogado: { select: { nombre: true } },
          },
        },
      },
      orderBy: { fechaVence: 'asc' },
    }),

    // Términos VENCIDOS sin atender
    prisma.terminoProcesal.findMany({
      where: {
        estado: 'VENCIDO',
        caso: filtroCaso,
      },
      include: {
        caso: { select: { id: true, numero: true, titulo: true } },
      },
      orderBy: { fechaVence: 'desc' },
      take: 10,
    }),
  ]);

  const enriquecer = (items, campofecha) =>
    items.map((item) => {
      const fecha = item[campofecha];
      const dias = Math.ceil((new Date(fecha) - hoy) / (1000 * 60 * 60 * 24));
      return {
        ...item,
        diasRestantes: dias,
        nivelAlerta: dias <= 0 ? 'CRITICA' : dias <= 1 ? 'CRITICA' : dias <= 3 ? 'ALTA' : 'MEDIA',
        semaforo: campofecha === 'fechaVence' ? semaforo(fecha, item.estado) : null,
      };
    });

  return {
    audiencias: enriquecer(audienciasUrgentes, 'fecha'),
    terminosProximos: enriquecer(terminosProximos, 'fechaVence'),
    terminosVencidos: terminosVencidos.map((t) => ({
      ...t,
      semaforo: 'VENCIDO',
      nivelAlerta: 'CRITICA',
    })),
    resumen: {
      totalAudienciasUrgentes: audienciasUrgentes.length,
      totalTerminosProximos: terminosProximos.length,
      totalTerminosVencidos: terminosVencidos.length,
      criticos:
        audienciasUrgentes.filter(
          (a) => Math.ceil((new Date(a.fecha) - hoy) / 86400000) <= 1
        ).length +
        terminosProximos.filter(
          (t) => Math.ceil((new Date(t.fechaVence) - hoy) / 86400000) <= 1
        ).length +
        terminosVencidos.length,
    },
  };
};
