import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { ok, created } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const loginSchema = z.object({
  email: z.string().email('Email inválido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

const cambiarPasswordSchema = z.object({
  passwordActual: z.string().min(1, 'Contraseña actual requerida.'),
  passwordNuevo: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres.')
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula.')
    .regex(/[0-9]/, 'Debe contener al menos un número.'),
});

export const registro = async (req, res) => {
  const { nombreFirma, ruc, emailFirma, nombreAbogado, numeroIdoneidad, email, password } = req.body;
  if (!nombreFirma || !ruc || !nombreAbogado || !email || !password) {
    throw new ValidationError('nombreFirma, ruc, nombreAbogado, email y password son requeridos.');
  }
  if (!numeroIdoneidad) {
    throw new ValidationError('El número de idoneidad del abogado es requerido.');
  }
  if (password.length < 6) {
    throw new ValidationError('La contraseña debe tener al menos 6 caracteres.');
  }

  const datos = await authService.registro({ nombreFirma, ruc, emailFirma: emailFirma || email, nombreAbogado, numeroIdoneidad, email, password });
  created(res, datos);
};

export const login = async (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos de inicio de sesión inválidos.', result.error.flatten().fieldErrors);
  }

  const { email, password } = result.data;
  const datos = await authService.login(email, password);
  ok(res, datos);
};

export const refresh = async (req, res) => {
  const { refreshToken } = req.body;
  const datos = await authService.refresh(refreshToken);
  ok(res, datos);
};

export const logout = async (req, res) => {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  ok(res, { message: 'Sesión cerrada correctamente.' });
};

export const logoutTodos = async (req, res) => {
  await authService.logoutTodos(req.user.sub);
  ok(res, { message: 'Todas las sesiones cerradas.' });
};

export const me = async (req, res) => {
  const abogado = await authService.me(req.user.sub);
  ok(res, abogado);
};

export const cambiarPassword = async (req, res) => {
  const result = cambiarPasswordSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos inválidos.', result.error.flatten().fieldErrors);
  }

  const { passwordActual, passwordNuevo } = result.data;
  await authService.cambiarPassword(req.user.sub, passwordActual, passwordNuevo);
  ok(res, { message: 'Contraseña actualizada correctamente. Inicie sesión nuevamente.' });
};
