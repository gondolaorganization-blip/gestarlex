import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { UnauthorizedError, NotFoundError, ValidationError } from '../utils/errors.js';

const ADMIN_TOKEN_EXPIRES = '24h';

const generarAdminToken = (admin) =>
  jwt.sign(
    { sub: admin.id, role: 'superadmin', nombre: admin.nombre },
    process.env.JWT_SECRET,
    { expiresIn: ADMIN_TOKEN_EXPIRES }
  );

// ── Auth ─────────────────────────────────────────────────────────────────────

export const login = async (email, password) => {
  const admin = await prisma.superAdmin.findUnique({ where: { email } });

  if (!admin || !admin.activo) throw new UnauthorizedError('Credenciales incorrectas.');

  const valido = await bcrypt.compare(password, admin.passwordHash);
  if (!valido) throw new UnauthorizedError('Credenciales incorrectas.');

  const token = generarAdminToken(admin);
  return { token, admin: { id: admin.id, nombre: admin.nombre, email: admin.email } };
};

// ── Firmas ────────────────────────────────────────────────────────────────────

export const listarFirmas = async ({ page = 1, limit = 20, busqueda, estado } = {}) => {
  const skip = (page - 1) * limit;

  const where = {
    ...(busqueda && {
      OR: [
        { nombre: { contains: busqueda, mode: 'insensitive' } },
        { email: { contains: busqueda, mode: 'insensitive' } },
        { ruc: { contains: busqueda, mode: 'insensitive' } },
      ],
    }),
    ...(estado && { suscripcionEstado: estado }),
  };

  const [firmas, total] = await Promise.all([
    prisma.firma.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        nombre: true,
        ruc: true,
        email: true,
        plan: true,
        activa: true,
        suscripcionEstado: true,
        trialEndsAt: true,
        suscripcionVenceEn: true,
        accessManual: true,
        paypalSubscriptionId: true,
        createdAt: true,
        _count: { select: { abogados: true, casos: true } },
      },
    }),
    prisma.firma.count({ where }),
  ]);

  return { firmas, total, page, pages: Math.ceil(total / limit) };
};

export const obtenerFirma = async (id) => {
  const firma = await prisma.firma.findUnique({
    where: { id },
    include: {
      _count: { select: { abogados: true, casos: true, clientes: true } },
      suscripcionEventos: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!firma) throw new NotFoundError('Firma no encontrada.');
  return firma;
};

export const actualizarSuscripcion = async (firmaId, datos, adminId) => {
  const { suscripcionEstado, trialEndsAt, suscripcionVenceEn, accessManual, plan } = datos;

  const firma = await prisma.firma.findUnique({ where: { id: firmaId } });
  if (!firma) throw new NotFoundError('Firma no encontrada.');

  const cambios = {};
  if (suscripcionEstado !== undefined) cambios.suscripcionEstado = suscripcionEstado;
  if (trialEndsAt !== undefined) cambios.trialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
  if (suscripcionVenceEn !== undefined) cambios.suscripcionVenceEn = suscripcionVenceEn ? new Date(suscripcionVenceEn) : null;
  if (accessManual !== undefined) cambios.accessManual = accessManual;
  if (plan !== undefined) cambios.plan = plan;

  if (Object.keys(cambios).length === 0) {
    throw new ValidationError('No se enviaron cambios.');
  }

  const [firmaActualizada] = await prisma.$transaction([
    prisma.firma.update({ where: { id: firmaId }, data: cambios }),
    prisma.suscripcionEvento.create({
      data: {
        firmaId,
        evento: _resolverEvento(cambios),
        detalle: cambios,
        creadoPor: `super_admin:${adminId}`,
      },
    }),
  ]);

  return firmaActualizada;
};

export const listarEventos = async (firmaId, limit = 50) => {
  const firma = await prisma.firma.findUnique({ where: { id: firmaId }, select: { id: true } });
  if (!firma) throw new NotFoundError('Firma no encontrada.');

  return prisma.suscripcionEvento.findMany({
    where: { firmaId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

// ── Helpers privados ──────────────────────────────────────────────────────────

const _resolverEvento = (cambios) => {
  if (cambios.accessManual === true) return 'ACCESO_MANUAL_OTORGADO';
  if (cambios.accessManual === false) return 'ACCESO_MANUAL_REVOCADO';
  if (cambios.suscripcionEstado === 'ACTIVO') return 'ACTIVADA';
  if (cambios.suscripcionEstado === 'SUSPENDIDO') return 'SUSPENDIDA';
  if (cambios.suscripcionEstado === 'VENCIDO') return 'VENCIDA';
  if (cambios.trialEndsAt) return 'TRIAL_EXTENDIDO';
  return 'ACTUALIZADA';
};
