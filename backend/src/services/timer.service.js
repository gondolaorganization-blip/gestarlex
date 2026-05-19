import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

// ─── CÁLCULO DE DURACIÓN ─────────────────────────────────────────────────────

const calcularSegundos = (timer) => {
  if (timer.estado === 'PAUSADO') {
    return timer.duracionAcumulada;
  }
  // CORRIENDO: acumulado + tiempo desde el último inicio
  const ahora = Date.now();
  const desdeUltimoInicio = Math.floor((ahora - new Date(timer.iniciadoEn).getTime()) / 1000);
  return timer.duracionAcumulada + desdeUltimoInicio;
};

const segundosAHoras = (segundos) => Math.round((segundos / 3600) * 100) / 100; // 2 decimales

const formatearDuracion = (segundos) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const enriquecerTimer = (t) => {
  const segundos = calcularSegundos(t);
  return {
    ...t,
    segundosActuales: segundos,
    duracionFormateada: formatearDuracion(segundos),
    horasDecimales: segundosAHoras(segundos),
  };
};

// ─── VERIFICACIÓN ─────────────────────────────────────────────────────────────

const verificarCaso = async (casoId, firmaId) => {
  const caso = await prisma.caso.findFirst({
    where: { id: casoId, firmaId },
    select: { id: true, numero: true, titulo: true, estado: true },
  });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  if (caso.estado === 'ARCHIVADO') throw new ValidationError('No se puede iniciar un timer en un caso archivado.');
  return caso;
};

const verificarOwner = (timer, userId) => {
  if (timer.abogadoId !== userId) throw new ForbiddenError('Solo puedes controlar tu propio timer.');
};

// ─── INICIAR ──────────────────────────────────────────────────────────────────

export const iniciar = async (casoId, descripcion, firmaId, user) => {
  await verificarCaso(casoId, firmaId);

  // Un abogado solo puede tener un timer activo por caso
  const existente = await prisma.timer.findUnique({
    where: { casoId_abogadoId: { casoId, abogadoId: user.sub } },
  });

  if (existente) {
    if (existente.estado === 'CORRIENDO') {
      throw new ValidationError('Ya tienes un timer corriendo en este caso. Paúsalo o deténlo primero.');
    }
    // Si estaba PAUSADO, reanudar
    const reanudado = await prisma.timer.update({
      where: { id: existente.id },
      data: {
        estado: 'CORRIENDO',
        iniciadoEn: new Date(),
        pausadoEn: null,
        ...(descripcion && { descripcion }),
      },
      include: {
        caso: { select: { id: true, numero: true, titulo: true } },
        abogado: { select: { id: true, nombre: true } },
      },
    });
    return { ...enriquecerTimer(reanudado), accion: 'reanudado' };
  }

  const timer = await prisma.timer.create({
    data: {
      casoId,
      abogadoId: user.sub,
      descripcion: descripcion || null,
      iniciadoEn: new Date(),
      duracionAcumulada: 0,
      estado: 'CORRIENDO',
    },
    include: {
      caso: { select: { id: true, numero: true, titulo: true } },
      abogado: { select: { id: true, nombre: true } },
    },
  });

  return { ...enriquecerTimer(timer), accion: 'iniciado' };
};

// ─── PAUSAR ───────────────────────────────────────────────────────────────────

export const pausar = async (timerId, user) => {
  const timer = await prisma.timer.findUnique({
    where: { id: timerId },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!timer) throw new NotFoundError('Timer no encontrado.');
  if (timer.caso.firmaId !== user.firmaId) throw new ForbiddenError('Acceso denegado.');
  verificarOwner(timer, user.sub);
  if (timer.estado === 'PAUSADO') throw new ValidationError('El timer ya está pausado.');

  const segundosActuales = calcularSegundos(timer);

  const actualizado = await prisma.timer.update({
    where: { id: timerId },
    data: {
      estado: 'PAUSADO',
      pausadoEn: new Date(),
      duracionAcumulada: segundosActuales,
    },
    include: {
      caso: { select: { id: true, numero: true, titulo: true } },
      abogado: { select: { id: true, nombre: true } },
    },
  });

  return { ...enriquecerTimer(actualizado), accion: 'pausado' };
};

// ─── REANUDAR ─────────────────────────────────────────────────────────────────

export const reanudar = async (timerId, user) => {
  const timer = await prisma.timer.findUnique({
    where: { id: timerId },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!timer) throw new NotFoundError('Timer no encontrado.');
  if (timer.caso.firmaId !== user.firmaId) throw new ForbiddenError('Acceso denegado.');
  verificarOwner(timer, user.sub);
  if (timer.estado === 'CORRIENDO') throw new ValidationError('El timer ya está corriendo.');

  const actualizado = await prisma.timer.update({
    where: { id: timerId },
    data: {
      estado: 'CORRIENDO',
      iniciadoEn: new Date(),
      pausadoEn: null,
    },
    include: {
      caso: { select: { id: true, numero: true, titulo: true } },
      abogado: { select: { id: true, nombre: true } },
    },
  });

  return { ...enriquecerTimer(actualizado), accion: 'reanudado' };
};

// ─── DETENER ──────────────────────────────────────────────────────────────────
// Detiene el timer y crea automáticamente un RegistroHoras

export const detener = async (timerId, opciones, user) => {
  const timer = await prisma.timer.findUnique({
    where: { id: timerId },
    include: {
      caso: { select: { id: true, numero: true, titulo: true, firmaId: true } },
      abogado: { select: { nombre: true } },
    },
  });
  if (!timer) throw new NotFoundError('Timer no encontrado.');
  if (timer.caso.firmaId !== user.firmaId) throw new ForbiddenError('Acceso denegado.');
  verificarOwner(timer, user.sub);

  const segundosTotales = calcularSegundos(timer);
  const horasDecimales = segundosAHoras(segundosTotales);

  // Mínimo 1 minuto para crear un registro
  if (segundosTotales < 60 && !opciones?.forzar) {
    // Igual eliminamos el timer pero no creamos registro
    await prisma.timer.delete({ where: { id: timerId } });
    return {
      accion: 'detenido',
      registro: null,
      segundos: segundosTotales,
      mensaje: 'Timer detenido. No se creó registro (duración menor a 1 minuto).',
    };
  }

  // Redondear a 0.25h si se solicita (cuartos de hora — práctica común en facturación)
  const horasFinal = opciones?.redondearCuartoHora
    ? Math.ceil(horasDecimales * 4) / 4
    : horasDecimales;

  const [registro] = await prisma.$transaction([
    prisma.registroHoras.create({
      data: {
        casoId: timer.casoId,
        abogadoId: timer.abogadoId,
        fecha: new Date(),
        horas: horasFinal,
        descripcion: opciones?.descripcion || timer.descripcion || 'Tiempo registrado con timer',
        facturable: opciones?.facturable !== false,
      },
    }),
    prisma.timer.delete({ where: { id: timerId } }),
  ]);

  return {
    accion: 'detenido',
    registro: {
      ...registro,
      caso: { id: timer.caso.id, numero: timer.caso.numero, titulo: timer.caso.titulo },
    },
    segundos: segundosTotales,
    duracionFormateada: formatearDuracion(segundosTotales),
    horasRegistradas: horasFinal,
  };
};

// ─── DESCARTAR ────────────────────────────────────────────────────────────────

export const descartar = async (timerId, user) => {
  const timer = await prisma.timer.findUnique({
    where: { id: timerId },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!timer) throw new NotFoundError('Timer no encontrado.');
  if (timer.caso.firmaId !== user.firmaId) throw new ForbiddenError('Acceso denegado.');
  verificarOwner(timer, user.sub);

  await prisma.timer.delete({ where: { id: timerId } });
  return { accion: 'descartado', segundos: calcularSegundos(timer) };
};

// ─── CONSULTAS ────────────────────────────────────────────────────────────────

export const obtener = async (timerId, user) => {
  const timer = await prisma.timer.findUnique({
    where: { id: timerId },
    include: {
      caso: { select: { id: true, numero: true, titulo: true, firmaId: true } },
      abogado: { select: { id: true, nombre: true } },
    },
  });
  if (!timer) throw new NotFoundError('Timer no encontrado.');
  if (timer.caso.firmaId !== user.firmaId) throw new ForbiddenError('Acceso denegado.');
  return enriquecerTimer(timer);
};

// Todos los timers activos del usuario autenticado
export const misTimers = async (user) => {
  const timers = await prisma.timer.findMany({
    where: { abogadoId: user.sub },
    include: {
      caso: { select: { id: true, numero: true, titulo: true, tipo: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return timers.map(enriquecerTimer);
};

// Todos los timers activos de la firma (para SOCIO/ADMIN)
export const timersFirma = async (firmaId) => {
  const timers = await prisma.timer.findMany({
    where: { caso: { firmaId } },
    include: {
      caso: { select: { id: true, numero: true, titulo: true } },
      abogado: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  return timers.map(enriquecerTimer);
};

// Timer activo de un abogado en un caso específico
export const timerDelCaso = async (casoId, firmaId, user) => {
  const caso = await prisma.caso.findFirst({ where: { id: casoId, firmaId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');

  const timer = await prisma.timer.findUnique({
    where: { casoId_abogadoId: { casoId, abogadoId: user.sub } },
    include: { caso: { select: { id: true, numero: true, titulo: true } } },
  });

  if (!timer) return null;
  return enriquecerTimer(timer);
};
