import prisma from '../lib/prisma.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import { clienteParaCuenta, hashContenido, googleEventIdDeterminista } from '../lib/googleCalendar.js';
import { ADAPTADORES, construirEvento, esDeGestarLex, origenGestarLex, fechaDeEvento } from '../lib/googleAdapters.js';

/**
 * Motor de sincronización bidireccional con Google Calendar.
 *
 * Reglas que este archivo no rompe nunca:
 *   1. Solo escribe en el calendario de la GoogleCuenta (garantizado por el wrapper).
 *   2. Un registro local ↔ un evento de Google, vía CalendarLink + ID determinístico.
 *   3. No borra nada: registra una SyncIncidencia y espera confirmación humana.
 *   4. Si cambió de los dos lados, congela y reporta en vez de pisar.
 */

const codigoHttp = (err) => err?.code ?? err?.response?.status ?? null;

// ─── INCIDENCIAS ──────────────────────────────────────────────────────────────

const abrirIncidencia = async ({ cuentaId, linkId, tipo, titulo, versionLocal, versionGoogle, detalle }) => {
  // No apilar la misma incidencia en cada corrida del cron.
  const existente = await prisma.syncIncidencia.findFirst({
    where: { cuentaId, linkId: linkId ?? undefined, tipo, estado: 'PENDIENTE' },
  });
  if (existente) return existente;

  return prisma.syncIncidencia.create({
    data: { cuentaId, linkId, tipo, titulo, versionLocal, versionGoogle, detalle, estado: 'PENDIENTE' },
  });
};

const congelar = (linkId, estado) =>
  prisma.calendarLink.update({ where: { id: linkId }, data: { estado } });

// ─── LECTURA DE REGISTROS LOCALES ─────────────────────────────────────────────

const leerRegistro = async (tipoLocal, localId) => {
  const adaptador = ADAPTADORES[tipoLocal];
  if (!adaptador) return null;
  return prisma[adaptador.modelo].findUnique({
    where: { id: localId },
    include: adaptador.incluir,
  });
};

// ─── DIRECCIÓN 1: GESTARLEX → GOOGLE ──────────────────────────────────────────

/**
 * Empuja UN registro a Google. Es la unidad de trabajo: el alta/edición en vivo y
 * el backfill masivo llaman ambos acá, así que las salvaguardas valen para los dos.
 *
 * Devuelve { accion } donde accion ∈ creado | actualizado | sin_cambios | adoptado |
 * conflicto | congelado | omitido
 */
export const empujarRegistro = async (cuenta, tipoLocal, localId, { cliente } = {}) => {
  const api = cliente || (await clienteParaCuenta(cuenta));
  const adaptador = ADAPTADORES[tipoLocal];

  const registro = await leerRegistro(tipoLocal, localId);
  if (!registro) return { accion: 'omitido', motivo: 'el registro local no existe' };

  if (adaptador.firmaDe(registro) !== cuenta.firmaId) {
    return { accion: 'omitido', motivo: 'el registro es de otra firma' };
  }

  const evento = construirEvento(tipoLocal, registro, cuenta.firmaId);
  const hash = hashContenido(evento);

  const link = await prisma.calendarLink.findUnique({
    where: { cuentaId_tipoLocal_localId: { cuentaId: cuenta.id, tipoLocal, localId } },
  });

  // SALVAGUARDA #4 — un link en conflicto está congelado hasta que el usuario decida.
  if (link?.estado === 'CONFLICTO') {
    return { accion: 'congelado', motivo: 'hay un conflicto sin resolver' };
  }
  // SALVAGUARDA #3 — hay un borrado esperando confirmación; no lo revivimos solos.
  if (link?.estado === 'PENDIENTE_BORRADO') {
    return { accion: 'congelado', motivo: 'hay un borrado pendiente de confirmación' };
  }

  // ── Alta ────────────────────────────────────────────────────────────────────
  if (!link) {
    try {
      const { data } = await api.insertar(evento);
      await prisma.calendarLink.create({
        data: {
          cuentaId: cuenta.id, tipoLocal, localId,
          googleEventId: data.id,
          hashLocal: hash,
          etagGoogle: data.etag,
          updatedGoogle: data.updated ? new Date(data.updated) : null,
          estado: 'OK',
          ultimoSyncEn: new Date(),
        },
      });
      return { accion: 'creado', googleEventId: data.id };
    } catch (err) {
      // SALVAGUARDA #2 — el ID es determinístico: si ya existe, es EL MISMO evento,
      // no un duplicado. Lo adoptamos en vez de crear otro.
      if (codigoHttp(err) === 409) {
        const { data } = await api.obtener(evento.id);
        await prisma.calendarLink.create({
          data: {
            cuentaId: cuenta.id, tipoLocal, localId,
            googleEventId: data.id,
            hashLocal: null, // desconocido: se resolverá en la próxima pasada
            etagGoogle: data.etag,
            updatedGoogle: data.updated ? new Date(data.updated) : null,
            estado: 'OK',
            ultimoSyncEn: new Date(),
          },
        });
        return { accion: 'adoptado', googleEventId: data.id };
      }
      throw err;
    }
  }

  // ── Sin cambios locales ─────────────────────────────────────────────────────
  if (link.hashLocal === hash) {
    return { accion: 'sin_cambios' };
  }

  // ── Hubo cambio local: ¿también cambió en Google? ───────────────────────────
  let remoto = null;
  try {
    ({ data: remoto } = await api.obtener(link.googleEventId));
  } catch (err) {
    if (codigoHttp(err) === 404 || codigoHttp(err) === 410) {
      // Desapareció de Google. NO se toca el registro local (salvaguarda #3).
      await congelar(link.id, 'PENDIENTE_BORRADO');
      await abrirIncidencia({
        cuentaId: cuenta.id, linkId: link.id, tipo: 'BORRADO_EN_GOOGLE',
        titulo: `${adaptador.etiqueta}: "${evento.summary}" ya no está en Google`,
        versionLocal: evento,
        detalle: 'El evento fue borrado en Google Calendar. El registro en GestarLex sigue intacto. ' +
                 'Confirmá si querés borrarlo también en GestarLex o volver a crearlo en Google.',
      });
      return { accion: 'conflicto', tipo: 'BORRADO_EN_GOOGLE' };
    }
    throw err;
  }

  if (remoto.status === 'cancelled') {
    await congelar(link.id, 'PENDIENTE_BORRADO');
    await abrirIncidencia({
      cuentaId: cuenta.id, linkId: link.id, tipo: 'BORRADO_EN_GOOGLE',
      titulo: `${adaptador.etiqueta}: "${evento.summary}" fue cancelado en Google`,
      versionLocal: evento, versionGoogle: remoto,
      detalle: 'El evento aparece como cancelado en Google. El registro en GestarLex sigue intacto.',
    });
    return { accion: 'conflicto', tipo: 'BORRADO_EN_GOOGLE' };
  }

  // SALVAGUARDA #4 — cambió acá Y allá: no se pisa ninguno de los dos.
  const cambioEnGoogle = link.etagGoogle && remoto.etag && remoto.etag !== link.etagGoogle;
  if (cambioEnGoogle) {
    await congelar(link.id, 'CONFLICTO');
    await abrirIncidencia({
      cuentaId: cuenta.id, linkId: link.id, tipo: 'CONFLICTO',
      titulo: `${adaptador.etiqueta}: "${evento.summary}" cambió en los dos lados`,
      versionLocal: evento, versionGoogle: remoto,
      detalle: 'Se modificó tanto en GestarLex como en Google desde la última sincronización. ' +
               'No se sobrescribió nada. Elegí cuál versión debe prevalecer.',
    });
    return { accion: 'conflicto', tipo: 'CONFLICTO' };
  }

  // ── Solo cambió local: se propaga ───────────────────────────────────────────
  try {
    const { data } = await api.actualizar(link.googleEventId, evento, remoto.etag);
    await prisma.calendarLink.update({
      where: { id: link.id },
      data: {
        hashLocal: hash,
        etagGoogle: data.etag,
        updatedGoogle: data.updated ? new Date(data.updated) : null,
        estado: 'OK',
        ultimoSyncEn: new Date(),
      },
    });
    return { accion: 'actualizado' };
  } catch (err) {
    // 412 = el If-Match falló: alguien tocó el evento entre nuestra lectura y la
    // escritura. Es una carrera, y se trata como conflicto, no se reintenta pisando.
    if (codigoHttp(err) === 412) {
      await congelar(link.id, 'CONFLICTO');
      await abrirIncidencia({
        cuentaId: cuenta.id, linkId: link.id, tipo: 'CONFLICTO',
        titulo: `${adaptador.etiqueta}: "${evento.summary}" cambió en Google durante la escritura`,
        versionLocal: evento, versionGoogle: remoto,
        detalle: 'Google rechazó la actualización porque el evento cambió mientras sincronizábamos.',
      });
      return { accion: 'conflicto', tipo: 'CONFLICTO' };
    }
    throw err;
  }
};

/**
 * Empuje en vivo, para llamar desde los services al crear/editar.
 *
 * Nunca lanza: si Google falla, la operación en GestarLex igual queda hecha. Que
 * el calendario no se actualice es molesto; que no se pueda guardar una audiencia
 * porque Google está caído sería inaceptable.
 *
 * Respeta `syncCompletoHabilitado`: mientras la prueba de un evento no haya pasado
 * en ambas direcciones, el único camino que escribe en Google es el endpoint de
 * prueba explícito. Nada se dispara solo antes de tiempo.
 */
export const empujarEnSegundoPlano = (firmaId, tipoLocal, localId) => {
  setImmediate(async () => {
    try {
      const cuenta = await prisma.googleCuenta.findUnique({ where: { firmaId } });
      if (!cuenta || cuenta.estado !== 'ACTIVA' || !cuenta.syncCompletoHabilitado) return;
      await empujarRegistro(cuenta, tipoLocal, localId);
    } catch (err) {
      console.error('[sync→google]', tipoLocal, localId, err.message);
    }
  });
};

// ─── DIRECCIÓN 2: GOOGLE → GESTARLEX ──────────────────────────────────────────

/** Un evento externo (nacido en Google) se refleja como EventoExterno. */
const aplicarEventoExterno = async (cuenta, evento, link) => {
  const { fecha, todoElDia } = fechaDeEvento(evento);
  if (!fecha) return { accion: 'omitido', motivo: 'evento sin fecha utilizable' };

  const fin = evento.end?.date
    ? new Date(`${evento.end.date}T00:00:00Z`)
    : evento.end?.dateTime
      ? new Date(evento.end.dateTime)
      : null;

  const datos = {
    firmaId: cuenta.firmaId,
    titulo: evento.summary || '(sin título)',
    inicio: fecha,
    fin,
    todoElDia,
    descripcion: evento.description || null,
    ubicacion: evento.location || null,
  };

  if (link) {
    await prisma.eventoExterno.update({ where: { id: link.localId }, data: datos });
    await prisma.calendarLink.update({
      where: { id: link.id },
      data: {
        etagGoogle: evento.etag,
        updatedGoogle: evento.updated ? new Date(evento.updated) : null,
        ultimoSyncEn: new Date(),
      },
    });
    return { accion: 'externo_actualizado' };
  }

  const creado = await prisma.eventoExterno.create({ data: datos });
  await prisma.calendarLink.create({
    data: {
      cuentaId: cuenta.id,
      tipoLocal: 'EXTERNO',
      localId: creado.id,
      googleEventId: evento.id,
      etagGoogle: evento.etag,
      updatedGoogle: evento.updated ? new Date(evento.updated) : null,
      estado: 'OK',
      ultimoSyncEn: new Date(),
    },
  });
  return { accion: 'externo_creado', localId: creado.id };
};

/** Un evento nuestro que fue editado en Google vuelve al registro de GestarLex. */
const aplicarEdicionRemota = async (cuenta, evento, link) => {
  const tipoLocal = link.tipoLocal;
  const adaptador = ADAPTADORES[tipoLocal];
  if (!adaptador) return { accion: 'omitido', motivo: `tipo desconocido: ${tipoLocal}` };

  const registro = await leerRegistro(tipoLocal, link.localId);

  // El registro local ya no existe: NO se borra el evento de Google (salvaguarda #3).
  if (!registro) {
    await congelar(link.id, 'PENDIENTE_BORRADO');
    await abrirIncidencia({
      cuentaId: cuenta.id, linkId: link.id, tipo: 'BORRADO_EN_GESTARLEX',
      titulo: `El ${adaptador.etiqueta.toLowerCase()} de "${evento.summary}" ya no existe en GestarLex`,
      versionGoogle: evento,
      detalle: 'El registro fue borrado en GestarLex pero el evento sigue en Google. ' +
               'Confirmá si querés borrarlo de Google también.',
    });
    return { accion: 'conflicto', tipo: 'BORRADO_EN_GESTARLEX' };
  }

  const eventoLocal = construirEvento(tipoLocal, registro, cuenta.firmaId);
  const hashActual = hashContenido(eventoLocal);

  // SALVAGUARDA #4 — ¿cambió también del lado de GestarLex desde el último sync?
  const cambioLocal = link.hashLocal !== null && link.hashLocal !== hashActual;
  if (cambioLocal) {
    await congelar(link.id, 'CONFLICTO');
    await abrirIncidencia({
      cuentaId: cuenta.id, linkId: link.id, tipo: 'CONFLICTO',
      titulo: `${adaptador.etiqueta}: "${evento.summary}" cambió en los dos lados`,
      versionLocal: eventoLocal, versionGoogle: evento,
      detalle: 'Se modificó en Google y en GestarLex desde la última sincronización. ' +
               'No se sobrescribió nada. Elegí cuál versión debe prevalecer.',
    });
    return { accion: 'conflicto', tipo: 'CONFLICTO' };
  }

  const cambios = adaptador.desdeEvento(evento);
  if (Object.keys(cambios).length === 0) return { accion: 'sin_cambios' };

  await prisma[adaptador.modelo].update({ where: { id: link.localId }, data: cambios });

  // Rehash sobre el registro ya actualizado, para que el próximo empuje no crea
  // que hubo un cambio local.
  const actualizado = await leerRegistro(tipoLocal, link.localId);
  const hashNuevo = hashContenido(construirEvento(tipoLocal, actualizado, cuenta.firmaId));

  await prisma.calendarLink.update({
    where: { id: link.id },
    data: {
      hashLocal: hashNuevo,
      etagGoogle: evento.etag,
      updatedGoogle: evento.updated ? new Date(evento.updated) : null,
      estado: 'OK',
      ultimoSyncEn: new Date(),
    },
  });

  return { accion: 'local_actualizado', cambios };
};

/** Evento cancelado/borrado en Google → incidencia, jamás borrado automático. */
const registrarCancelacion = async (cuenta, evento, link) => {
  if (!link) return { accion: 'omitido', motivo: 'cancelación de un evento que no seguíamos' };

  await congelar(link.id, 'PENDIENTE_BORRADO');

  const etiqueta = ADAPTADORES[link.tipoLocal]?.etiqueta || 'Evento externo';
  await abrirIncidencia({
    cuentaId: cuenta.id, linkId: link.id, tipo: 'BORRADO_EN_GOOGLE',
    titulo: `${etiqueta}: un evento fue borrado en Google`,
    versionGoogle: evento,
    detalle: 'El evento se borró en Google Calendar. En GestarLex NO se borró nada. ' +
             'Confirmá si querés borrar también el registro local.',
  });

  return { accion: 'borrado_pendiente' };
};

/**
 * Trae de Google todo lo que cambió desde la última corrida.
 *
 * Usa syncToken: Google devuelve solo el delta, así que es barato y no re-procesa
 * lo mismo una y otra vez. Si Google invalida el token (410), se rehace una lectura
 * completa acotada a una ventana de fechas.
 */
export const traerCambios = async (cuenta, { cliente, ventanaDias = 400 } = {}) => {
  const api = cliente || (await clienteParaCuenta(cuenta));

  const resumen = { revisados: 0, externos_creados: 0, externos_actualizados: 0, locales_actualizados: 0, conflictos: 0, borrados_pendientes: 0, sin_cambios: 0, omitidos: 0 };

  const paramsBase = cuenta.syncToken
    ? { syncToken: cuenta.syncToken }
    : {
        timeMin: new Date(Date.now() - 30 * 86400000).toISOString(),
        timeMax: new Date(Date.now() + ventanaDias * 86400000).toISOString(),
        singleEvents: true,
      };

  let pageToken;
  let nuevoSyncToken = null;

  do {
    let respuesta;
    try {
      respuesta = await api.listar({ ...paramsBase, ...(pageToken && { pageToken }), maxResults: 250, showDeleted: true });
    } catch (err) {
      if (codigoHttp(err) === 410) {
        // syncToken vencido: reintento desde cero, una sola vez.
        await prisma.googleCuenta.update({ where: { id: cuenta.id }, data: { syncToken: null } });
        return traerCambios({ ...cuenta, syncToken: null }, { cliente: api, ventanaDias });
      }
      throw err;
    }

    for (const evento of respuesta.data.items || []) {
      resumen.revisados++;

      const link = await prisma.calendarLink.findUnique({
        where: { cuentaId_googleEventId: { cuentaId: cuenta.id, googleEventId: evento.id } },
      });

      // Links congelados: no se tocan hasta que el usuario resuelva la incidencia.
      if (link && link.estado !== 'OK') { resumen.omitidos++; continue; }

      let r;
      if (evento.status === 'cancelled') {
        r = await registrarCancelacion(cuenta, evento, link);
      } else if (esDeGestarLex(evento)) {
        const origen = origenGestarLex(evento);
        if (origen.firmaId && origen.firmaId !== cuenta.firmaId) { resumen.omitidos++; continue; }
        // Sin link pero marcado como nuestro: el link se perdió. Se reconstruye
        // en vez de duplicar (salvaguarda #2).
        const efectivo = link || (await reconstruirLink(cuenta, evento, origen));
        r = efectivo
          ? await aplicarEdicionRemota(cuenta, evento, efectivo)
          : { accion: 'omitido', motivo: 'no se pudo reconstruir el vínculo' };
      } else {
        r = await aplicarEventoExterno(cuenta, evento, link);
      }

      if (r.accion === 'externo_creado') resumen.externos_creados++;
      else if (r.accion === 'externo_actualizado') resumen.externos_actualizados++;
      else if (r.accion === 'local_actualizado') resumen.locales_actualizados++;
      else if (r.accion === 'conflicto') resumen.conflictos++;
      else if (r.accion === 'borrado_pendiente') resumen.borrados_pendientes++;
      else if (r.accion === 'sin_cambios') resumen.sin_cambios++;
      else resumen.omitidos++;
    }

    pageToken = respuesta.data.nextPageToken;
    if (respuesta.data.nextSyncToken) nuevoSyncToken = respuesta.data.nextSyncToken;
  } while (pageToken);

  await prisma.googleCuenta.update({
    where: { id: cuenta.id },
    data: { ...(nuevoSyncToken && { syncToken: nuevoSyncToken }), ultimoSyncEn: new Date() },
  });

  return resumen;
};

/** Reconstruye el CalendarLink de un evento marcado como nuestro cuyo vínculo se perdió. */
const reconstruirLink = async (cuenta, evento, origen) => {
  if (!origen?.localId || !ADAPTADORES[origen.tipoLocal]) return null;

  const registro = await leerRegistro(origen.tipoLocal, origen.localId);
  if (!registro) return null;

  // El ID determinístico debe coincidir: si no, el evento no es el que dice ser.
  if (evento.id !== googleEventIdDeterminista(origen.tipoLocal, origen.localId)) return null;

  return prisma.calendarLink.create({
    data: {
      cuentaId: cuenta.id,
      tipoLocal: origen.tipoLocal,
      localId: origen.localId,
      googleEventId: evento.id,
      hashLocal: hashContenido(construirEvento(origen.tipoLocal, registro, cuenta.firmaId)),
      etagGoogle: evento.etag,
      updatedGoogle: evento.updated ? new Date(evento.updated) : null,
      estado: 'OK',
      ultimoSyncEn: new Date(),
    },
  });
};

// ─── EMPUJE MASIVO (BACKFILL) ─────────────────────────────────────────────────

/**
 * Empuja a Google todos los registros sincronizables de la firma.
 *
 * Está detrás del interruptor `syncCompletoHabilitado`, que arranca apagado: hasta
 * que la prueba de un evento pase en ambas direcciones, esto no corre. No es una
 * convención, es una barrera — el cron y el endpoint chequean lo mismo.
 */
export const empujarTodo = async (cuenta, { desde, hasta, limite = 500, forzar = false } = {}) => {
  if (!cuenta.syncCompletoHabilitado && !forzar) {
    throw new AppError(
      'El sync completo está deshabilitado. Probá primero con un evento en cada ' +
        'dirección y habilitalo desde la pantalla de Google Calendar.',
      409
    );
  }

  const api = await clienteParaCuenta(cuenta);
  const resumen = { creados: 0, actualizados: 0, sin_cambios: 0, adoptados: 0, conflictos: 0, congelados: 0, omitidos: 0, errores: [] };

  const desdeFecha = desde || new Date(Date.now() - 30 * 86400000);
  const hastaFecha = hasta || new Date(Date.now() + 365 * 86400000);

  for (const [tipoLocal, adaptador] of Object.entries(ADAPTADORES)) {
    const registros = await prisma[adaptador.modelo].findMany({
      where: {
        ...adaptador.dondeFirma(cuenta.firmaId),
        [adaptador.campoFecha]: { gte: desdeFecha, lte: hastaFecha },
      },
      select: { id: true },
      take: limite,
      orderBy: { [adaptador.campoFecha]: 'asc' },
    });

    for (const { id } of registros) {
      try {
        const r = await empujarRegistro(cuenta, tipoLocal, id, { cliente: api });
        if (r.accion === 'creado') resumen.creados++;
        else if (r.accion === 'actualizado') resumen.actualizados++;
        else if (r.accion === 'sin_cambios') resumen.sin_cambios++;
        else if (r.accion === 'adoptado') resumen.adoptados++;
        else if (r.accion === 'conflicto') resumen.conflictos++;
        else if (r.accion === 'congelado') resumen.congelados++;
        else resumen.omitidos++;
      } catch (err) {
        resumen.errores.push({ tipoLocal, id, mensaje: err.message });
      }
    }
  }

  await prisma.googleCuenta.update({ where: { id: cuenta.id }, data: { ultimoSyncEn: new Date() } });
  return resumen;
};

/** Corrida completa: primero trae de Google, después empuja lo local. */
export const sincronizar = async (firmaId, opciones = {}) => {
  const cuenta = await prisma.googleCuenta.findUnique({ where: { firmaId } });
  if (!cuenta) throw new NotFoundError('No hay una cuenta de Google conectada.');
  if (cuenta.estado !== 'ACTIVA') {
    throw new AppError(`La conexión con Google está en estado ${cuenta.estado}. Reconectá.`, 409);
  }

  const entrada = await traerCambios(cuenta);
  // Releer: traerCambios actualiza el syncToken.
  const cuentaFresca = await prisma.googleCuenta.findUnique({ where: { firmaId } });
  const salida = cuentaFresca.syncCompletoHabilitado || opciones.forzar
    ? await empujarTodo(cuentaFresca, opciones)
    : { omitido: 'sync completo deshabilitado hasta que pase la prueba de un evento' };

  return { entrada, salida };
};
