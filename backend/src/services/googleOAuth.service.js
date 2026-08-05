import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import prisma from '../lib/prisma.js';
import { cifrar } from '../lib/cifrado.js';
import { AppError, NotFoundError, ValidationError } from '../utils/errors.js';
import {
  SCOPES,
  NOMBRE_CALENDARIO,
  crearOAuthClient,
  urlDeConsentimiento,
  assertCalendarioSeguro,
  verificarCalendarioDestino,
  authParaCuenta,
} from '../lib/googleCalendar.js';

/**
 * Conexión OAuth del despacho con Google Calendar.
 *
 * Una GoogleCuenta por firma: los eventos de todos los abogados van al mismo
 * calendario secundario "GestarLex".
 */

const STATE_TTL = '10m';

// ─── INICIO ───────────────────────────────────────────────────────────────────

/**
 * El `state` va firmado con el JWT_SECRET del sistema: si alguien fabrica un
 * callback, la firma no valida y no se guarda nada. Es la protección contra CSRF
 * del flujo de OAuth.
 */
export const iniciar = (user) => {
  const state = jwt.sign(
    { firmaId: user.firmaId, abogadoId: user.sub, prop: 'google_oauth' },
    process.env.JWT_SECRET,
    { expiresIn: STATE_TTL }
  );
  return { url: urlDeConsentimiento(state) };
};

const verificarState = (state) => {
  if (!state) throw new ValidationError('Falta el parámetro state.');
  let payload;
  try {
    payload = jwt.verify(state, process.env.JWT_SECRET);
  } catch {
    throw new ValidationError('El state es inválido o expiró. Volvé a iniciar la conexión.');
  }
  if (payload.prop !== 'google_oauth') throw new ValidationError('State de otro flujo.');
  return payload;
};

// ─── CALLBACK ─────────────────────────────────────────────────────────────────

/**
 * Canjea el código por tokens y localiza el calendario "GestarLex".
 *
 * SALVAGUARDA #1 — si el calendario no aparece, o si el que aparece es el
 * principal, esto aborta SIN guardar la cuenta. Preferimos no conectar antes que
 * conectar apuntando a un calendario equivocado.
 */
export const callback = async ({ code, state, error }) => {
  if (error) throw new AppError(`Google devolvió un error: ${error}`, 400);
  if (!code) throw new ValidationError('Falta el código de autorización.');

  const { firmaId, abogadoId } = verificarState(state);

  const oauth2 = crearOAuthClient();
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    throw new AppError(
      'Google no devolvió un refresh token. Revocá el acceso de GestarLex en ' +
        'myaccount.google.com/permissions y volvé a conectar.',
      400
    );
  }

  oauth2.setCredentials(tokens);

  // Buscar el calendario secundario por nombre exacto.
  const { data: lista } = await google
    .calendar({ version: 'v3', auth: oauth2 })
    .calendarList.list({ maxResults: 250, showHidden: true });

  const items = lista.items || [];

  // El ID del calendario principal ES la dirección de la cuenta conectada. Sacarlo
  // de acá evita pedir el scope userinfo.email solo para mostrar el email en la UI.
  const principal = items.find((c) => c.primary === true);
  const googleEmail = principal?.id || 'desconocido';

  const candidatos = items.filter((c) => c.summary === NOMBRE_CALENDARIO && c.primary !== true);

  if (candidatos.length === 0) {
    const disponibles = items.map((c) => c.summary).join(', ');
    throw new AppError(
      `No se encontró un calendario secundario llamado "${NOMBRE_CALENDARIO}" en ${googleEmail}. ` +
        `Calendarios visibles: ${disponibles || 'ninguno'}. No se guardó la conexión.`,
      400
    );
  }
  if (candidatos.length > 1) {
    throw new AppError(
      `Hay ${candidatos.length} calendarios llamados "${NOMBRE_CALENDARIO}". ` +
        'Dejá uno solo para que no haya ambigüedad. No se guardó la conexión.',
      400
    );
  }

  const destino = candidatos[0];

  // Cinturón y tirantes: el destino jamás puede coincidir con el calendario principal.
  if (principal && destino.id === principal.id) {
    throw new AppError('SALVAGUARDA: el calendario destino es el principal. No se conectó.', 400);
  }

  assertCalendarioSeguro(destino.id);
  await verificarCalendarioDestino(oauth2, destino.id);

  const datos = {
    abogadoId,
    googleEmail,
    calendarId: destino.id,
    calendarSummary: destino.summary,
    refreshTokenCifrado: cifrar(tokens.refresh_token),
    accessTokenCifrado: cifrar(tokens.access_token),
    accessTokenExpiraEn: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scopes: SCOPES,
    estado: 'ACTIVA',
    ultimoError: null,
    ultimoErrorEn: null,
  };

  // Reconectar no borra los links existentes: se conserva el mapeo y por lo tanto
  // la idempotencia. Solo se resetea el syncToken para forzar una lectura completa.
  const cuenta = await prisma.googleCuenta.upsert({
    where: { firmaId },
    create: { firmaId, ...datos },
    update: { ...datos, syncToken: null },
  });

  return estadoPublico(cuenta);
};

// ─── ESTADO / DESCONEXIÓN ─────────────────────────────────────────────────────

/** Nunca expone tokens, ni cifrados. Solo lo necesario para la UI. */
const estadoPublico = (cuenta) =>
  cuenta
    ? {
        conectada: true,
        googleEmail: cuenta.googleEmail,
        calendarSummary: cuenta.calendarSummary,
        estado: cuenta.estado,
        syncCompletoHabilitado: cuenta.syncCompletoHabilitado,
        ultimoSyncEn: cuenta.ultimoSyncEn,
        ultimoError: cuenta.ultimoError,
        conectadaEn: cuenta.createdAt,
      }
    : { conectada: false };

export const estado = async (firmaId) => {
  const cuenta = await prisma.googleCuenta.findUnique({ where: { firmaId } });
  const pendientes = cuenta
    ? await prisma.syncIncidencia.count({ where: { cuentaId: cuenta.id, estado: 'PENDIENTE' } })
    : 0;
  return { ...estadoPublico(cuenta), incidenciasPendientes: pendientes };
};

/**
 * Desconectar revoca el token en Google y borra la cuenta local.
 *
 * SALVAGUARDA #3 — no toca ni un solo evento: ni en Google ni en GestarLex. Los
 * eventos ya sincronizados quedan donde están. Desconectar no es borrar.
 */
export const desconectar = async (firmaId) => {
  const cuenta = await prisma.googleCuenta.findUnique({ where: { firmaId } });
  if (!cuenta) throw new NotFoundError('No hay una cuenta de Google conectada.');

  try {
    const auth = await authParaCuenta(cuenta);
    await auth.revokeCredentials();
  } catch {
    // Si Google ya revocó el permiso por su lado, igual limpiamos lo local.
  }

  await prisma.googleCuenta.delete({ where: { id: cuenta.id } });
  return { ok: true, mensaje: 'Google Calendar desconectado. Ningún evento fue borrado.' };
};
