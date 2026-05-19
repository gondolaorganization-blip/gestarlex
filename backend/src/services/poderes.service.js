import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors.js';

// ─── SEMÁFORO DE VENCIMIENTO ──────────────────────────────────────────────────
// Poderes: ventana más amplia que términos — 30/15/7 días de anticipación

const calcularEstadoVencimiento = (fechaVence, activo) => {
  if (!activo) return { estado: 'REVOCADO', diasRestantes: null, color: 'GRIS' };
  if (!fechaVence) return { estado: 'INDEFINIDO', diasRestantes: null, color: 'VERDE' };

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vence = new Date(fechaVence);
  vence.setHours(0, 0, 0, 0);
  const dias = Math.ceil((vence - hoy) / (1000 * 60 * 60 * 24));

  if (dias < 0) return { estado: 'VENCIDO', diasRestantes: dias, color: 'VENCIDO' };
  if (dias === 0) return { estado: 'VENCE_HOY', diasRestantes: 0, color: 'ROJO' };
  if (dias <= 7) return { estado: 'CRITICO', diasRestantes: dias, color: 'ROJO' };
  if (dias <= 15) return { estado: 'URGENTE', diasRestantes: dias, color: 'NARANJA' };
  if (dias <= 30) return { estado: 'PROXIMO', diasRestantes: dias, color: 'AMARILLO' };
  return { estado: 'VIGENTE', diasRestantes: dias, color: 'VERDE' };
};

const enriquecerPoder = (p) => ({
  ...p,
  vencimiento: calcularEstadoVencimiento(p.fechaVence, p.activo),
});

// ─── VERIFICACIÓN DE ACCESO ───────────────────────────────────────────────────

const verificarFirma = async (clienteId, firmaId) => {
  const cliente = await prisma.cliente.findFirst({ where: { id: clienteId, firmaId } });
  if (!cliente) throw new NotFoundError('Cliente no encontrado en esta firma.');
  return cliente;
};

// ─── LISTAR ───────────────────────────────────────────────────────────────────

export const listarPorCliente = async (clienteId, firmaId) => {
  await verificarFirma(clienteId, firmaId);

  const poderes = await prisma.poder.findMany({
    where: { clienteId },
    include: {
      caso: { select: { id: true, numero: true, titulo: true } },
    },
    orderBy: [{ activo: 'desc' }, { fechaOtorgamiento: 'desc' }],
  });

  return poderes.map(enriquecerPoder);
};

export const listarPorCaso = async (casoId, firmaId) => {
  const caso = await prisma.caso.findFirst({ where: { id: casoId, firmaId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');

  const poderes = await prisma.poder.findMany({
    where: { casoId },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, ruc: true } },
    },
    orderBy: { fechaOtorgamiento: 'desc' },
  });

  return poderes.map(enriquecerPoder);
};

export const listarFirma = async (firmaId, filtros = {}) => {
  const { tipo, activo, busqueda, pagina = 1, porPagina = 20 } = filtros;

  const where = {
    cliente: { firmaId },
  };

  if (tipo) where.tipo = tipo;
  if (activo !== undefined) where.activo = activo === 'true' || activo === true;
  if (busqueda) {
    where.OR = [
      { descripcion: { contains: busqueda, mode: 'insensitive' } },
      { notaria: { contains: busqueda, mode: 'insensitive' } },
      { cliente: { nombre: { contains: busqueda, mode: 'insensitive' } } },
    ];
  }

  const skip = (Number(pagina) - 1) * Number(porPagina);

  const [total, poderes] = await Promise.all([
    prisma.poder.count({ where }),
    prisma.poder.findMany({
      where,
      include: {
        cliente: { select: { id: true, nombre: true, cedula: true, ruc: true, tipo: true } },
        caso: { select: { id: true, numero: true, titulo: true } },
      },
      orderBy: [{ activo: 'desc' }, { fechaVence: 'asc' }],
      skip,
      take: Number(porPagina),
    }),
  ]);

  return {
    datos: poderes.map(enriquecerPoder),
    paginacion: {
      total,
      pagina: Number(pagina),
      porPagina: Number(porPagina),
      totalPaginas: Math.ceil(total / Number(porPagina)),
    },
  };
};

// ─── OBTENER ──────────────────────────────────────────────────────────────────

export const obtener = async (id, firmaId) => {
  const poder = await prisma.poder.findFirst({
    where: { id },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, ruc: true, tipo: true, firmaId: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
  });

  if (!poder) throw new NotFoundError('Poder no encontrado.');
  if (poder.cliente.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');

  return enriquecerPoder(poder);
};

// ─── CREAR ────────────────────────────────────────────────────────────────────

export const crear = async (datos, firmaId, user) => {
  if (user.rol === 'PASANTE') throw new ForbiddenError('Los pasantes no pueden registrar poderes.');

  await verificarFirma(datos.clienteId, firmaId);

  // Si se vincula a un caso, verificar que pertenezca a la firma
  if (datos.casoId) {
    const caso = await prisma.caso.findFirst({ where: { id: datos.casoId, firmaId } });
    if (!caso) throw new NotFoundError('Caso no encontrado en esta firma.');
    // El caso debe ser del mismo cliente
    if (caso.clienteId !== datos.clienteId) {
      throw new ValidationError('El caso no pertenece a este cliente.');
    }
  }

  const poder = await prisma.poder.create({
    data: {
      clienteId: datos.clienteId,
      casoId: datos.casoId || null,
      tipo: datos.tipo || 'ESPECIAL',
      fechaOtorgamiento: new Date(datos.fechaOtorgamiento),
      fechaVence: datos.fechaVence ? new Date(datos.fechaVence) : null,
      notaria: datos.notaria || null,
      tomo: datos.tomo || null,
      folio: datos.folio || null,
      descripcion: datos.descripcion || null,
      activo: true,
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
  });

  return enriquecerPoder(poder);
};

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────

export const actualizar = async (id, datos, firmaId, user) => {
  if (user.rol === 'PASANTE') throw new ForbiddenError('Acceso denegado.');

  const poder = await prisma.poder.findFirst({
    where: { id },
    include: { cliente: { select: { firmaId: true } } },
  });
  if (!poder) throw new NotFoundError('Poder no encontrado.');
  if (poder.cliente.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');

  const actualizado = await prisma.poder.update({
    where: { id },
    data: {
      ...(datos.tipo && { tipo: datos.tipo }),
      ...(datos.fechaOtorgamiento && { fechaOtorgamiento: new Date(datos.fechaOtorgamiento) }),
      ...(datos.fechaVence !== undefined && {
        fechaVence: datos.fechaVence ? new Date(datos.fechaVence) : null,
      }),
      ...(datos.notaria !== undefined && { notaria: datos.notaria }),
      ...(datos.tomo !== undefined && { tomo: datos.tomo }),
      ...(datos.folio !== undefined && { folio: datos.folio }),
      ...(datos.descripcion !== undefined && { descripcion: datos.descripcion }),
      ...(datos.casoId !== undefined && { casoId: datos.casoId || null }),
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
  });

  return enriquecerPoder(actualizado);
};

// ─── REVOCAR ──────────────────────────────────────────────────────────────────

export const revocar = async (id, firmaId, user) => {
  if (!['ADMIN', 'SOCIO'].includes(user.rol)) {
    throw new ForbiddenError('Solo socios o administradores pueden revocar poderes.');
  }

  const poder = await prisma.poder.findFirst({
    where: { id },
    include: { cliente: { select: { firmaId: true } } },
  });
  if (!poder) throw new NotFoundError('Poder no encontrado.');
  if (poder.cliente.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  if (!poder.activo) throw new ValidationError('El poder ya se encuentra revocado.');

  const actualizado = await prisma.poder.update({
    where: { id },
    data: { activo: false },
  });
  return enriquecerPoder(actualizado);
};

// ─── ALERTAS ──────────────────────────────────────────────────────────────────

export const proximosAVencer = async (firmaId, diasMax = 30) => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const limite = new Date(hoy);
  limite.setDate(hoy.getDate() + diasMax);

  const poderes = await prisma.poder.findMany({
    where: {
      activo: true,
      fechaVence: { gte: hoy, lte: limite },
      cliente: { firmaId },
    },
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, ruc: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
    orderBy: { fechaVence: 'asc' },
  });

  return poderes.map(enriquecerPoder);
};

export const vencidos = async (firmaId) => {
  const hoy = new Date();

  const poderes = await prisma.poder.findMany({
    where: {
      activo: true,
      fechaVence: { lt: hoy },
      cliente: { firmaId },
    },
    include: {
      cliente: { select: { id: true, nombre: true } },
      caso: { select: { id: true, numero: true, titulo: true } },
    },
    orderBy: { fechaVence: 'desc' },
  });

  return poderes.map(enriquecerPoder);
};

export const resumenFirma = async (firmaId) => {
  const hoy = new Date();
  const en30dias = new Date(hoy);
  en30dias.setDate(hoy.getDate() + 30);

  const [total, activos, vencidosCount, proximosCount, porTipo] = await Promise.all([
    prisma.poder.count({ where: { cliente: { firmaId } } }),
    prisma.poder.count({ where: { activo: true, cliente: { firmaId } } }),
    prisma.poder.count({
      where: { activo: true, fechaVence: { lt: hoy }, cliente: { firmaId } },
    }),
    prisma.poder.count({
      where: {
        activo: true,
        fechaVence: { gte: hoy, lte: en30dias },
        cliente: { firmaId },
      },
    }),
    prisma.poder.groupBy({
      by: ['tipo'],
      where: { cliente: { firmaId } },
      _count: { tipo: true },
    }),
  ]);

  return { total, activos, vencidos: vencidosCount, proximosAVencer: proximosCount, porTipo };
};
