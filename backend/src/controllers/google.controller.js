import prisma from '../lib/prisma.js';
import * as oauthService from '../services/googleOAuth.service.js';
import * as syncService from '../services/calendarSync.service.js';
import * as incidenciasService from '../services/googleIncidencias.service.js';
import { ADAPTADORES } from '../lib/googleAdapters.js';
import { AppError, NotFoundError, ValidationError } from '../utils/errors.js';

const frontendUrl = () => process.env.FRONTEND_URL || 'https://lex.gestarsoft.com';

export const iniciarOAuth = async (req, res) => {
  const { url } = oauthService.iniciar(req.user);
  res.json({ ok: true, url });
};

/**
 * Google redirige acá desde el navegador, así que la respuesta es un redirect al
 * frontend (no JSON). El detalle del error viaja en el query string para que la UI
 * pueda mostrarlo tal cual — importa especialmente cuando falla el chequeo del
 * calendario, porque ahí el mensaje explica qué hay que corregir en Google.
 */
export const callbackOAuth = async (req, res) => {
  const destino = `${frontendUrl()}/configuracion/google-calendar`;
  try {
    const estado = await oauthService.callback(req.query);
    const params = new URLSearchParams({
      conectado: '1',
      email: estado.googleEmail,
      calendario: estado.calendarSummary,
    });
    res.redirect(`${destino}?${params}`);
  } catch (err) {
    res.redirect(`${destino}?${new URLSearchParams({ error: err.message })}`);
  }
};

export const estadoConexion = async (req, res) => {
  res.json({ ok: true, data: await oauthService.estado(req.user.firmaId) });
};

export const desconectar = async (req, res) => {
  res.json({ ok: true, ...(await oauthService.desconectar(req.user.firmaId)) });
};

// ─── SYNC ─────────────────────────────────────────────────────────────────────

const cuentaDe = async (firmaId) => {
  const cuenta = await prisma.googleCuenta.findUnique({ where: { firmaId } });
  if (!cuenta) throw new NotFoundError('No hay una cuenta de Google conectada.');
  return cuenta;
};

/**
 * PRUEBA DE UN SOLO EVENTO — GestarLex → Google.
 *
 * Empuja exactamente un registro y devuelve el detalle de lo que pasó. Es el
 * endpoint de la prueba controlada: no toca nada más, ni siquiera si el sync
 * completo estuviera habilitado.
 */
export const probarEmpuje = async (req, res) => {
  const { tipo, id } = req.body;
  if (!ADAPTADORES[tipo]) {
    throw new ValidationError(`Tipo inválido. Opciones: ${Object.keys(ADAPTADORES).join(', ')}.`);
  }
  if (!id) throw new ValidationError('Falta el id del registro.');

  const cuenta = await cuentaDe(req.user.firmaId);
  const resultado = await syncService.empujarRegistro(cuenta, tipo, id);

  const link = await prisma.calendarLink.findUnique({
    where: { cuentaId_tipoLocal_localId: { cuentaId: cuenta.id, tipoLocal: tipo, localId: id } },
  });

  res.json({
    ok: true,
    resultado,
    calendario: cuenta.calendarSummary,
    link: link && {
      googleEventId: link.googleEventId,
      estado: link.estado,
      ultimoSyncEn: link.ultimoSyncEn,
    },
  });
};

/** Trae de Google lo que cambió. Seguro de correr siempre: es incremental. */
export const sincronizarEntrada = async (req, res) => {
  const cuenta = await cuentaDe(req.user.firmaId);
  res.json({ ok: true, entrada: await syncService.traerCambios(cuenta) });
};

/** Corrida completa. Bloqueada hasta que se habilite el sync completo. */
export const sincronizarTodo = async (req, res) => {
  res.json({ ok: true, ...(await syncService.sincronizar(req.user.firmaId)) });
};

/**
 * Habilita el sync masivo. Solo debería usarse después de que la prueba de un
 * evento haya funcionado en las dos direcciones.
 */
export const habilitarSyncCompleto = async (req, res) => {
  const cuenta = await cuentaDe(req.user.firmaId);
  const { habilitado } = req.body;
  if (typeof habilitado !== 'boolean') throw new ValidationError('Falta el campo habilitado (booleano).');

  const actualizada = await prisma.googleCuenta.update({
    where: { id: cuenta.id },
    data: { syncCompletoHabilitado: habilitado },
  });

  res.json({
    ok: true,
    syncCompletoHabilitado: actualizada.syncCompletoHabilitado,
    mensaje: habilitado
      ? 'Sync completo habilitado. El cron ya puede empujar todos los eventos.'
      : 'Sync completo deshabilitado. Solo corre el sync de entrada.',
  });
};

// ─── INCIDENCIAS ──────────────────────────────────────────────────────────────

export const listarIncidencias = async (req, res) => {
  const data = await incidenciasService.listar(req.user.firmaId, { estado: req.query.estado });
  res.json({ ok: true, data, total: data.length });
};

export const resolverIncidencia = async (req, res) => {
  const resuelta = await incidenciasService.resolver(req.user.firmaId, req.params.id, {
    resolucion: req.body.resolucion,
    abogadoId: req.user.sub,
  });
  res.json({ ok: true, data: resuelta });
};

/**
 * Candidatos para la prueba: próximos registros sincronizables, con el título tal
 * como se vería en Google. Evita tener que buscar un cuid a mano en la base.
 */
export const listarCandidatos = async (req, res) => {
  const { firmaId } = req.user;
  const desde = new Date();
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 180);

  const grupos = await Promise.all(
    Object.entries(ADAPTADORES).map(async ([tipo, adaptador]) => {
      const registros = await prisma[adaptador.modelo].findMany({
        where: {
          ...adaptador.dondeFirma(firmaId),
          [adaptador.campoFecha]: { gte: desde, lte: hasta },
        },
        include: adaptador.incluir,
        orderBy: { [adaptador.campoFecha]: 'asc' },
        take: 25,
      });

      return registros.map((r) => ({
        tipo,
        tipoEtiqueta: adaptador.etiqueta,
        id: r.id,
        // El mismo texto que tendría el evento en Google, para que sepas qué vas a ver.
        titulo: adaptador.aEvento(r).summary,
        fecha: r[adaptador.campoFecha],
        caso: r.caso ? `${r.caso.numero} — ${r.caso.titulo}` : null,
      }));
    })
  );

  const candidatos = grupos.flat().sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  res.json({ ok: true, data: candidatos, total: candidatos.length });
};
