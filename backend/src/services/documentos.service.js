import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Un pasante no puede ver documentos confidenciales
const puedeVerConfidencial = (rol) => ['ADMIN', 'SOCIO', 'ASOCIADO'].includes(rol);

const verificarAccesoCaso = async (casoId, firmaId) => {
  const caso = await prisma.caso.findFirst({ where: { id: casoId, firmaId } });
  if (!caso) throw new NotFoundError('Caso no encontrado.');
  return caso;
};

// ─── LISTAR ───────────────────────────────────────────────────────────────────

export const listarPorCaso = async (casoId, firmaId, user) => {
  await verificarAccesoCaso(casoId, firmaId);

  const where = { casoId };
  if (!puedeVerConfidencial(user.rol)) where.confidencial = false;

  return prisma.documento.findMany({
    where,
    select: {
      id: true, nombre: true, tipo: true, archivo: true, mimeType: true,
      tamanoBytes: true, version: true, fechaSubida: true, confidencial: true, descripcion: true,
      subidoPor: { select: { id: true, nombre: true } },
    },
    orderBy: [{ nombre: 'asc' }, { version: 'desc' }],
  });
};

// ─── OBTENER ──────────────────────────────────────────────────────────────────

export const obtener = async (id, firmaId, user) => {
  const doc = await prisma.documento.findFirst({
    where: { id },
    include: {
      caso: { select: { id: true, numero: true, titulo: true, firmaId: true } },
      subidoPor: { select: { id: true, nombre: true } },
    },
  });

  if (!doc) throw new NotFoundError('Documento no encontrado.');
  if (doc.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');
  if (doc.confidencial && !puedeVerConfidencial(user.rol)) {
    throw new ForbiddenError('No tiene acceso a documentos confidenciales.');
  }

  return doc;
};

// ─── SUBIR ────────────────────────────────────────────────────────────────────

export const subir = async (casoId, file, datos, firmaId, user) => {
  if (user.rol === 'PASANTE' && datos.confidencial) {
    throw new ForbiddenError('Los pasantes no pueden subir documentos confidenciales.');
  }

  await verificarAccesoCaso(casoId, firmaId);

  // Control de versiones: si ya existe un documento con el mismo nombre, incrementar
  const existente = await prisma.documento.findFirst({
    where: { casoId, nombre: datos.nombre },
    orderBy: { version: 'desc' },
  });

  const version = existente ? existente.version + 1 : 1;

  return prisma.documento.create({
    data: {
      casoId,
      nombre: datos.nombre || file.originalname,
      tipo: datos.tipo || null,
      archivo: file.path,
      mimeType: file.mimetype,
      tamanoBytes: file.size,
      version,
      subidoPorId: user.sub,
      confidencial: datos.confidencial === 'true' || datos.confidencial === true,
      descripcion: datos.descripcion || null,
    },
    select: {
      id: true, nombre: true, tipo: true, archivo: true, mimeType: true,
      tamanoBytes: true, version: true, fechaSubida: true, confidencial: true,
      subidoPor: { select: { nombre: true } },
    },
  });
};

// ─── ACTUALIZAR METADATOS ─────────────────────────────────────────────────────

export const actualizarMetadatos = async (id, datos, firmaId, user) => {
  if (user.rol === 'PASANTE') throw new ForbiddenError('Acceso denegado.');

  const doc = await prisma.documento.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!doc) throw new NotFoundError('Documento no encontrado.');
  if (doc.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');

  // Solo SOCIO+ puede cambiar confidencialidad
  const esConfidencial =
    datos.confidencial !== undefined && ['ADMIN', 'SOCIO'].includes(user.rol)
      ? datos.confidencial === 'true' || datos.confidencial === true
      : doc.confidencial;

  return prisma.documento.update({
    where: { id },
    data: {
      ...(datos.nombre && { nombre: datos.nombre }),
      ...(datos.tipo !== undefined && { tipo: datos.tipo }),
      ...(datos.descripcion !== undefined && { descripcion: datos.descripcion }),
      confidencial: esConfidencial,
    },
  });
};

// ─── ELIMINAR ─────────────────────────────────────────────────────────────────

export const eliminar = async (id, firmaId, user) => {
  if (!['ADMIN', 'SOCIO'].includes(user.rol)) {
    throw new ForbiddenError('Solo socios o administradores pueden eliminar documentos.');
  }

  const doc = await prisma.documento.findFirst({
    where: { id },
    include: { caso: { select: { firmaId: true } } },
  });
  if (!doc) throw new NotFoundError('Documento no encontrado.');
  if (doc.caso.firmaId !== firmaId) throw new ForbiddenError('Acceso denegado.');

  // Eliminar archivo físico
  try {
    if (fs.existsSync(doc.archivo)) fs.unlinkSync(doc.archivo);
  } catch {
    // Si el archivo físico no existe, continuar eliminando el registro
  }

  await prisma.documento.delete({ where: { id } });
};

// ─── DESCARGA SEGURA ──────────────────────────────────────────────────────────

export const obtenerRutaDescarga = async (id, firmaId, user) => {
  const doc = await obtener(id, firmaId, user);

  const rutaAbsoluta = path.resolve(doc.archivo);
  if (!fs.existsSync(rutaAbsoluta)) {
    throw new NotFoundError('Archivo no encontrado en el servidor.');
  }

  return {
    ruta: rutaAbsoluta,
    nombre: doc.nombre,
    mimeType: doc.mimeType || 'application/octet-stream',
  };
};

// ─── HISTORIAL DE VERSIONES ───────────────────────────────────────────────────

export const versiones = async (casoId, nombre, firmaId, user) => {
  await verificarAccesoCaso(casoId, firmaId);

  const where = { casoId, nombre };
  if (!puedeVerConfidencial(user.rol)) where.confidencial = false;

  return prisma.documento.findMany({
    where,
    select: {
      id: true, nombre: true, version: true, fechaSubida: true,
      tamanoBytes: true, confidencial: true,
      subidoPor: { select: { nombre: true } },
    },
    orderBy: { version: 'desc' },
  });
};

// ─── ESTADÍSTICAS DE DOCUMENTOS ───────────────────────────────────────────────

export const estadisticasFirma = async (firmaId) => {
  const [total, confidenciales, porTipo] = await Promise.all([
    prisma.documento.count({ where: { caso: { firmaId } } }),
    prisma.documento.count({ where: { caso: { firmaId }, confidencial: true } }),
    prisma.documento.groupBy({
      by: ['tipo'],
      where: { caso: { firmaId } },
      _count: { tipo: true },
      orderBy: { _count: { tipo: 'desc' } },
    }),
  ]);

  return { total, confidenciales, porTipo };
};
