import crypto from 'crypto';
import { google } from 'googleapis';
import prisma from './prisma.js';
import { cifrar, descifrar } from './cifrado.js';

/**
 * Wrapper único de acceso a Google Calendar.
 *
 * Toda llamada a Google del sistema pasa por acá. Ninguna función expuesta acepta
 * un calendarId como parámetro: se lee siempre de la GoogleCuenta y se valida antes
 * de cada escritura. Esa es la garantía de que los eventos del despacho no pueden
 * terminar en el calendario personal principal.
 */

// ─── SCOPES ───────────────────────────────────────────────────────────────────
// Los mínimos que sirven. NO se pide 'auth/calendar' (control total: permitiría
// crear y borrar calendarios enteros), solo eventos + lectura de la lista de
// calendarios, que se usa una única vez para encontrar el calendario "GestarLex".
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
];

export const ZONA_HORARIA = 'America/Panama';
export const NOMBRE_CALENDARIO = 'GestarLex';

// ─── SALVAGUARDA #1 — el calendario está blindado ─────────────────────────────

/**
 * Google no ofrece un scope "solo este calendario", así que la restricción se
 * garantiza en código: este guard corre antes de CUALQUIER escritura.
 */
export const assertCalendarioSeguro = (calendarId) => {
  if (!calendarId || typeof calendarId !== 'string' || !calendarId.trim()) {
    throw new Error('SALVAGUARDA: no hay calendarId configurado. Se aborta la operación.');
  }

  const id = calendarId.trim().toLowerCase();

  // 'primary' es el alias de Google para el calendario personal principal.
  if (id === 'primary') {
    throw new Error('SALVAGUARDA: se intentó escribir en el calendario principal. Abortado.');
  }

  // Un calendario secundario siempre tiene un ID con forma de dirección
  // (…@group.calendar.google.com). Si el ID es el email de la cuenta, ES el principal.
  if (!id.includes('@')) {
    throw new Error(`SALVAGUARDA: calendarId con formato inesperado ("${calendarId}"). Abortado.`);
  }
  if (id.endsWith('@gmail.com') || id.endsWith('@googlemail.com')) {
    throw new Error('SALVAGUARDA: ese calendarId es el calendario personal principal. Abortado.');
  }

  return calendarId;
};

/**
 * Verificación de la conexión: confirma contra Google que el calendario guardado
 * sigue existiendo, se llama "GestarLex" y no está marcado como primary.
 * Se corre al conectar y antes de cada backfill.
 */
export const verificarCalendarioDestino = async (auth, calendarId) => {
  assertCalendarioSeguro(calendarId);

  const calendar = google.calendar({ version: 'v3', auth });
  const { data } = await calendar.calendarList.get({ calendarId });

  if (data.primary === true) {
    throw new Error('SALVAGUARDA: Google reporta ese calendario como principal. Abortado.');
  }
  if (data.summary !== NOMBRE_CALENDARIO) {
    throw new Error(
      `SALVAGUARDA: el calendario destino se llama "${data.summary}", se esperaba "${NOMBRE_CALENDARIO}". Abortado.`
    );
  }
  if (data.accessRole !== 'owner' && data.accessRole !== 'writer') {
    throw new Error(`SALVAGUARDA: sin permiso de escritura (accessRole=${data.accessRole}). Abortado.`);
  }

  return data;
};

// ─── SALVAGUARDA #2 — ID determinístico ───────────────────────────────────────

// Google exige que los IDs de evento usen base32hex: dígitos 0-9 y letras a-v.
// Ojo: la 'x' NO es válida, por eso el prefijo es "glc" y no "glx".
const ALFABETO_B32HEX = '0123456789abcdefghijklmnopqrstuv';
const PREFIJO_EVENTO = 'glc';

const aBase32Hex = (buffer) => {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const byte of buffer) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO_B32HEX[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO_B32HEX[(valor << (5 - bits)) & 31];
  return salida;
};

/**
 * Mismo registro local → siempre el mismo ID de evento en Google.
 *
 * Es el candado de respaldo de la idempotencia: si la tabla CalendarLink se pierde
 * o queda desincronizada, un intento de re-alta choca contra el evento existente y
 * Google responde 409 (que tratamos como "ya existe"), en vez de crear un duplicado.
 */
export const googleEventIdDeterminista = (tipoLocal, localId) => {
  const digest = crypto.createHash('sha256').update(`${tipoLocal}:${localId}`).digest();
  return PREFIJO_EVENTO + aBase32Hex(digest.subarray(0, 20)); // 3 + 32 = 35 chars
};

/** Huella de los campos sincronizados: si no cambió, no se llama a Google. */
export const hashContenido = (evento) =>
  crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        summary: evento.summary ?? null,
        description: evento.description ?? null,
        location: evento.location ?? null,
        start: evento.start ?? null,
        end: evento.end ?? null,
      })
    )
    .digest('hex');

// ─── OAUTH ────────────────────────────────────────────────────────────────────

export const crearOAuthClient = () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error(
      'Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI en el entorno.'
    );
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
};

export const urlDeConsentimiento = (state) =>
  crearOAuthClient().generateAuthUrl({
    access_type: 'offline',   // sin esto Google no manda refresh token
    prompt: 'consent',        // fuerza refresh token nuevo aunque ya haya autorizado antes
    include_granted_scopes: true,
    scope: SCOPES,
    state,
  });

/**
 * Devuelve un cliente de Calendar autenticado para la cuenta del despacho, con el
 * access token renovado si hacía falta. El token nuevo se persiste cifrado.
 */
export const authParaCuenta = async (cuenta) => {
  const oauth2 = crearOAuthClient();

  oauth2.setCredentials({
    refresh_token: descifrar(cuenta.refreshTokenCifrado),
    ...(cuenta.accessTokenCifrado && {
      access_token: descifrar(cuenta.accessTokenCifrado),
      expiry_date: cuenta.accessTokenExpiraEn?.getTime(),
    }),
  });

  // googleapis renueva solo cuando el access token está vencido; acá capturamos
  // el resultado para guardarlo cifrado y no pedir uno nuevo en cada llamada.
  oauth2.on('tokens', async (tokens) => {
    try {
      await prisma.googleCuenta.update({
        where: { id: cuenta.id },
        data: {
          ...(tokens.access_token && {
            accessTokenCifrado: cifrar(tokens.access_token),
            accessTokenExpiraEn: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          }),
          // Google rara vez rota el refresh token, pero si lo hace hay que guardarlo.
          ...(tokens.refresh_token && { refreshTokenCifrado: cifrar(tokens.refresh_token) }),
          estado: 'ACTIVA',
        },
      });
    } catch {
      // No romper la operación en curso por un fallo al cachear el token.
    }
  });

  return oauth2;
};

/**
 * Cliente de Calendar con el calendarId ya fijado e inyectado en cada llamada.
 * Las funciones devueltas NO aceptan calendarId — no hay forma de apuntarlas a otro
 * calendario desde el código de negocio ni desde un request.
 */
export const clienteParaCuenta = async (cuenta) => {
  const calendarId = assertCalendarioSeguro(cuenta.calendarId);
  const auth = await authParaCuenta(cuenta);
  const calendar = google.calendar({ version: 'v3', auth });

  return {
    calendarId,
    auth,

    listar: (params = {}) => calendar.events.list({ ...params, calendarId }),

    obtener: (eventId) => calendar.events.get({ calendarId, eventId }),

    insertar: (recurso) => {
      assertCalendarioSeguro(calendarId);
      return calendar.events.insert({ calendarId, requestBody: recurso });
    },

    actualizar: (eventId, recurso, etag) => {
      assertCalendarioSeguro(calendarId);
      return calendar.events.update({
        calendarId,
        eventId,
        requestBody: recurso,
        // If-Match: si el evento cambió en Google desde que lo leímos, Google
        // rechaza con 412 en vez de pisar. Respaldo de la salvaguarda #4.
        ...(etag && { headers: { 'If-Match': etag } }),
      });
    },

    /**
     * SALVAGUARDA #3 — el borrado real existe, pero ningún proceso automático lo
     * llama: solo se ejecuta desde la resolución explícita de una SyncIncidencia.
     */
    borrarConfirmadoPorUsuario: (eventId, { confirmadoPorId }) => {
      if (!confirmadoPorId) {
        throw new Error('SALVAGUARDA: borrado en Google sin confirmación de un usuario. Abortado.');
      }
      assertCalendarioSeguro(calendarId);
      return calendar.events.delete({ calendarId, eventId });
    },
  };
};

/** La cuenta del despacho, o null si todavía no se conectó Google. */
export const cuentaDeFirma = (firmaId) =>
  prisma.googleCuenta.findUnique({ where: { firmaId } });
