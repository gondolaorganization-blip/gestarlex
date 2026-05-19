import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';

export const adminAuthenticate = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('Token no proporcionado.');

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'superadmin') throw new ForbiddenError('Acceso restringido a super administradores.');
    req.admin = payload; // { sub, role, nombre }
    next();
  } catch (err) {
    if (err instanceof ForbiddenError) throw err;
    throw new UnauthorizedError('Token inválido o expirado.');
  }
};
