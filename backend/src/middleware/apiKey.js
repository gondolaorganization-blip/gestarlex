import prisma from '../lib/prisma.js';
import { hashApiKey, esFormatoValido } from '../lib/apiKeys.js';
import { UnauthorizedError, ForbiddenError, AppError } from '../utils/errors.js';

// Solo se actualiza ultimoUsoEn si pasó este tiempo, para no escribir en cada request
const INTERVALO_REGISTRO_USO_MS = 60_000;

/**
 * Autentica una automatización externa mediante API key.
 *
 * Acepta la key en el header `X-API-Key` o en `Authorization: Bearer glx_...`.
 * Deja en req.user el mismo shape que produce el JWT ({ sub, firmaId, rol, nombre }),
 * de modo que los services existentes aplican sus reglas de firma y rol sin cambios.
 */
export const apiKeyAuth = async (req, _res, next) => {
  try {
    const header = req.headers['x-api-key'];
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const valor = header || (esFormatoValido(bearer) ? bearer : null);

    if (!valor) throw new UnauthorizedError('API key no proporcionada.');
    if (!esFormatoValido(valor)) throw new UnauthorizedError('API key inválida.');

    const apiKey = await prisma.apiKey.findUnique({
      where: { hash: hashApiKey(valor) },
      include: {
        abogado: { select: { id: true, nombre: true, rol: true, activo: true, firmaId: true } },
      },
    });

    // Mismo mensaje para key inexistente, revocada o vencida — no damos pistas
    if (!apiKey || !apiKey.activa || apiKey.revocadaEn) {
      throw new UnauthorizedError('API key inválida.');
    }
    if (apiKey.expiraEn && apiKey.expiraEn <= new Date()) {
      throw new UnauthorizedError('API key inválida.');
    }
    if (!apiKey.abogado?.activo) {
      throw new ForbiddenError('El usuario asociado a esta API key está desactivado.');
    }

    req.user = {
      sub: apiKey.abogadoId,
      firmaId: apiKey.firmaId,
      rol: apiKey.abogado.rol,
      nombre: apiKey.abogado.nombre,
      viaApiKey: true,
    };
    req.apiKey = { id: apiKey.id, nombre: apiKey.nombre, scopes: apiKey.scopes };

    // Registro de uso en segundo plano — nunca debe hacer fallar el request
    const desactualizado =
      !apiKey.ultimoUsoEn || Date.now() - apiKey.ultimoUsoEn.getTime() > INTERVALO_REGISTRO_USO_MS;
    if (desactualizado) {
      prisma.apiKey
        .update({ where: { id: apiKey.id }, data: { ultimoUsoEn: new Date() } })
        .catch(() => {});
    }

    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Exige que la key tenga el scope indicado.
 * El borrado no existe como scope: no hay rutas de borrado en este router.
 */
export const requireScope = (scope) => (req, _res, next) => {
  if (!req.apiKey) return next(new UnauthorizedError('No autenticado por API key.'));
  if (!req.apiKey.scopes.includes(scope)) {
    return next(new ForbiddenError(`Esta API key no tiene el permiso "${scope}".`));
  }
  next();
};

/**
 * Rate limit en memoria. Suficiente para una sola instancia; con varias, mover a Redis.
 *
 * `clave` decide contra qué se cuenta. Se usa en dos niveles:
 *   - por IP, ANTES de autenticar, para que una ráfaga de keys inválidas no dispare
 *     una consulta a la base por request;
 *   - por key, DESPUÉS de autenticar, para acotar el uso de cada automatización.
 * Requiere `trust proxy` en Express para que req.ip sea la IP real del cliente.
 */
export const rateLimit = ({ max = 60, ventanaMs = 60_000, clave } = {}) => {
  const golpes = new Map();
  const obtenerClave = clave || ((req) => req.apiKey?.id || req.ip || 'desconocido');

  return (req, res, next) => {
    const ahora = Date.now();
    const id = obtenerClave(req);
    const registro = golpes.get(id);

    if (!registro || ahora > registro.reinicia) {
      golpes.set(id, { conteo: 1, reinicia: ahora + ventanaMs });
    } else if (registro.conteo >= max) {
      res.setHeader('Retry-After', Math.ceil((registro.reinicia - ahora) / 1000));
      return next(new AppError('Demasiadas peticiones. Intenta de nuevo en un momento.', 429));
    } else {
      registro.conteo += 1;
    }

    // Limpieza perezosa para que el Map no crezca sin límite
    if (golpes.size > 500) {
      for (const [k, v] of golpes) if (ahora > v.reinicia) golpes.delete(k);
    }

    next();
  };
};
