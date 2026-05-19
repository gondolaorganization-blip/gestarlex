import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors.js';

export const authenticate = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new UnauthorizedError('Token no proporcionado.');

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { sub, firmaId, rol, nombre }
    next();
  } catch {
    throw new UnauthorizedError('Token inválido o expirado.');
  }
};
