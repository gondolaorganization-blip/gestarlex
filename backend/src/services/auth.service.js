import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';
import { UnauthorizedError, NotFoundError } from '../utils/errors.js';

const ACCESS_EXPIRES = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_DAYS = 30;

const generarAccessToken = (abogado) =>
  jwt.sign(
    {
      sub: abogado.id,
      firmaId: abogado.firmaId,
      rol: abogado.rol,
      nombre: abogado.nombre,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );

const generarRefreshToken = () => crypto.randomBytes(64).toString('hex');

export const login = async (email, password) => {
  const abogado = await prisma.abogado.findUnique({
    where: { email },
    include: { firma: { select: { id: true, nombre: true, plan: true, activa: true } } },
  });

  if (!abogado || !abogado.passwordHash) {
    throw new UnauthorizedError('Credenciales incorrectas.');
  }

  if (!abogado.activo) {
    throw new UnauthorizedError('Usuario inactivo. Contacte al administrador de la firma.');
  }

  if (!abogado.firma.activa) {
    throw new UnauthorizedError('La firma no se encuentra activa.');
  }

  const passwordValido = await bcrypt.compare(password, abogado.passwordHash);
  if (!passwordValido) throw new UnauthorizedError('Credenciales incorrectas.');

  const accessToken = generarAccessToken(abogado);
  const refreshTokenRaw = generarRefreshToken();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_DAYS);

  await prisma.refreshToken.create({
    data: { token: refreshTokenRaw, abogadoId: abogado.id, expiresAt },
  });

  const { passwordHash: _, ...abogadoSafe } = abogado;

  return { accessToken, refreshToken: refreshTokenRaw, abogado: abogadoSafe };
};

export const refresh = async (refreshTokenRaw) => {
  if (!refreshTokenRaw) throw new UnauthorizedError('Refresh token no proporcionado.');

  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshTokenRaw },
    include: { abogado: { include: { firma: { select: { activa: true } } } } },
  });

  if (!stored) throw new UnauthorizedError('Refresh token inválido.');
  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: stored.id } });
    throw new UnauthorizedError('Refresh token expirado. Inicie sesión nuevamente.');
  }

  if (!stored.abogado.activo || !stored.abogado.firma.activa) {
    throw new UnauthorizedError('Cuenta inactiva.');
  }

  const accessToken = generarAccessToken(stored.abogado);
  return { accessToken };
};

export const logout = async (refreshTokenRaw) => {
  if (!refreshTokenRaw) return;
  await prisma.refreshToken.deleteMany({ where: { token: refreshTokenRaw } });
};

export const logoutTodos = async (abogadoId) => {
  await prisma.refreshToken.deleteMany({ where: { abogadoId } });
};

export const me = async (abogadoId) => {
  const abogado = await prisma.abogado.findUnique({
    where: { id: abogadoId },
    select: {
      id: true,
      firmaId: true,
      nombre: true,
      numeroIdoneidad: true,
      especialidad: true,
      email: true,
      telefono: true,
      rol: true,
      activo: true,
      avatarUrl: true,
      createdAt: true,
      firma: { select: { id: true, nombre: true, plan: true, logo: true } },
    },
  });

  if (!abogado) throw new NotFoundError('Usuario no encontrado.');
  return abogado;
};

export const cambiarPassword = async (abogadoId, passwordActual, passwordNuevo) => {
  const abogado = await prisma.abogado.findUnique({ where: { id: abogadoId } });
  if (!abogado?.passwordHash) throw new UnauthorizedError('Sin contraseña configurada.');

  const valido = await bcrypt.compare(passwordActual, abogado.passwordHash);
  if (!valido) throw new UnauthorizedError('Contraseña actual incorrecta.');

  const passwordHash = await bcrypt.hash(passwordNuevo, 12);
  await prisma.abogado.update({ where: { id: abogadoId }, data: { passwordHash } });
  await prisma.refreshToken.deleteMany({ where: { abogadoId } });
};
