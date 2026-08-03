import prisma from '../lib/prisma.js';
import { generarApiKey } from '../lib/apiKeys.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

// Permisos disponibles. No existe un scope de borrado a propósito:
// el router de integraciones no expone ninguna ruta que borre.
export const SCOPES_VALIDOS = ['casos:read', 'casos:write'];

const selectPublico = {
  id: true,
  nombre: true,
  prefijo: true,
  scopes: true,
  activa: true,
  ultimoUsoEn: true,
  expiraEn: true,
  revocadaEn: true,
  createdAt: true,
  abogado: { select: { id: true, nombre: true } },
};

// ─── CREAR ────────────────────────────────────────────────────────────────────

export const crear = async (firmaId, datos, user) => {
  const scopes = datos.scopes?.length ? datos.scopes : ['casos:read'];
  const invalidos = scopes.filter((s) => !SCOPES_VALIDOS.includes(s));
  if (invalidos.length) {
    throw new ValidationError(
      `Permisos no válidos: ${invalidos.join(', ')}. Disponibles: ${SCOPES_VALIDOS.join(', ')}.`,
    );
  }

  // La key actúa en nombre de un abogado — por defecto, quien la crea
  const abogadoId = datos.abogadoId || user.sub;
  const abogado = await prisma.abogado.findFirst({ where: { id: abogadoId, firmaId } });
  if (!abogado) throw new NotFoundError('Abogado no encontrado en esta firma.');

  const { valor, prefijo, hash } = generarApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      firmaId,
      abogadoId,
      nombre: datos.nombre,
      prefijo,
      hash,
      scopes,
      expiraEn: datos.expiraEn ? new Date(datos.expiraEn) : null,
    },
    select: selectPublico,
  });

  // `valor` se devuelve una única vez: no queda guardado en ningún lado
  return { ...apiKey, valor };
};

// ─── LISTAR ───────────────────────────────────────────────────────────────────

export const listar = async (firmaId) =>
  prisma.apiKey.findMany({
    where: { firmaId },
    select: selectPublico,
    orderBy: { createdAt: 'desc' },
  });

// ─── REVOCAR ──────────────────────────────────────────────────────────────────

// Revocación lógica, no borrado: la key deja de funcionar pero queda el rastro.
export const revocar = async (id, firmaId) => {
  const apiKey = await prisma.apiKey.findFirst({ where: { id, firmaId } });
  if (!apiKey) throw new NotFoundError('API key no encontrada.');

  return prisma.apiKey.update({
    where: { id },
    data: { activa: false, revocadaEn: new Date() },
    select: selectPublico,
  });
};
