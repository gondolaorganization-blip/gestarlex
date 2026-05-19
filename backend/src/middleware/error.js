import { AppError } from '../utils/errors.js';

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok: false,
      message: err.message,
      ...(err.errors && { errors: err.errors }),
      ...(err.errorCode && { errorCode: err.errorCode }),
    });
  }

  // Errores de Prisma
  if (err.code === 'P2002') {
    return res.status(409).json({
      ok: false,
      message: 'Ya existe un registro con esos datos únicos.',
      field: err.meta?.target,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ ok: false, message: 'Registro no encontrado.' });
  }

  console.error('[ERROR]', err);
  return res.status(500).json({ ok: false, message: 'Error interno del servidor.' });
};

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
