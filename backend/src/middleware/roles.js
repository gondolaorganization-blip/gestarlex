import { ForbiddenError } from '../utils/errors.js';

// Jerarquía de roles — ADMIN > SOCIO > ASOCIADO > PASANTE
const JERARQUIA = { ADMIN: 4, SOCIO: 3, ASOCIADO: 2, PASANTE: 1 };

/**
 * Verifica que el usuario tenga al menos uno de los roles indicados.
 * authorize('SOCIO', 'ADMIN') → permite SOCIO y ADMIN
 */
export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) throw new ForbiddenError('No autenticado.');
  if (!roles.includes(req.user.rol)) {
    throw new ForbiddenError(`Se requiere rol: ${roles.join(' o ')}.`);
  }
  next();
};

/**
 * Verifica que el usuario tenga al menos el nivel jerárquico indicado.
 * minRol('ASOCIADO') → permite ASOCIADO, SOCIO y ADMIN
 */
export const minRol = (rolMinimo) => (req, _res, next) => {
  if (!req.user) throw new ForbiddenError('No autenticado.');
  const nivelUsuario = JERARQUIA[req.user.rol] ?? 0;
  const nivelRequerido = JERARQUIA[rolMinimo] ?? 99;
  if (nivelUsuario < nivelRequerido) {
    throw new ForbiddenError(`Se requiere rol mínimo: ${rolMinimo}.`);
  }
  next();
};

/**
 * Verifica que el recurso pertenezca a la firma del usuario autenticado.
 * Pasa el firmaId al request para validaciones posteriores.
 */
export const mismafirma = (req, _res, next) => {
  const firmaIdParam = req.params.firmaId || req.body.firmaId;
  if (firmaIdParam && firmaIdParam !== req.user.firmaId) {
    throw new ForbiddenError('No tiene acceso a recursos de otra firma.');
  }
  next();
};
