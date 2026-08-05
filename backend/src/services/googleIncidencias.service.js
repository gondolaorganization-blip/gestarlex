import prisma from '../lib/prisma.js';
import { AppError, NotFoundError, ValidationError } from '../utils/errors.js';
import { clienteParaCuenta, hashContenido } from '../lib/googleCalendar.js';
import { ADAPTADORES, construirEvento } from '../lib/googleAdapters.js';
import { empujarRegistro } from './calendarSync.service.js';

/**
 * Bandeja de incidencias del sync.
 *
 * Este es el ÚNICO archivo donde un evento o un registro se borra de verdad, y
 * siempre a pedido explícito de una persona identificada. El motor de sync no
 * importa nada de acá: no puede borrar aunque quisiera.
 */

const RESOLUCIONES = {
  CONFLICTO: ['GESTARLEX', 'GOOGLE', 'IGNORAR'],
  BORRADO_EN_GOOGLE: ['BORRAR_LOCAL', 'RESTAURAR_EN_GOOGLE', 'IGNORAR'],
  BORRADO_EN_GESTARLEX: ['BORRAR_EN_GOOGLE', 'IGNORAR'],
  ERROR: ['IGNORAR'],
};

export const listar = async (firmaId, { estado = 'PENDIENTE' } = {}) => {
  const cuenta = await prisma.googleCuenta.findUnique({ where: { firmaId } });
  if (!cuenta) return [];

  const incidencias = await prisma.syncIncidencia.findMany({
    where: { cuentaId: cuenta.id, ...(estado !== 'TODAS' && { estado }) },
    include: { link: { select: { tipoLocal: true, localId: true, googleEventId: true, estado: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return incidencias.map((i) => ({
    ...i,
    opciones: RESOLUCIONES[i.tipo] || ['IGNORAR'],
    // Resumen legible de en qué difieren las dos versiones — para no obligar a
    // leer dos JSON enteros y compararlos a ojo.
    diferencias: diferenciasEntre(i.versionLocal, i.versionGoogle),
  }));
};

const CAMPOS_COMPARABLES = [
  ['summary', 'Título'],
  ['location', 'Lugar'],
  ['description', 'Descripción'],
];

const textoFecha = (v) => v?.start?.dateTime || v?.start?.date || null;

const diferenciasEntre = (local, google) => {
  if (!local || !google) return [];
  const difs = [];

  for (const [campo, etiqueta] of CAMPOS_COMPARABLES) {
    if ((local[campo] || null) !== (google[campo] || null)) {
      difs.push({ campo: etiqueta, gestarlex: local[campo] || '(vacío)', google: google[campo] || '(vacío)' });
    }
  }

  const fLocal = textoFecha(local);
  const fGoogle = textoFecha(google);
  if (fLocal !== fGoogle) {
    difs.push({ campo: 'Fecha', gestarlex: fLocal || '(sin fecha)', google: fGoogle || '(sin fecha)' });
  }

  return difs;
};

// ─── RESOLUCIÓN ───────────────────────────────────────────────────────────────

/**
 * Aplica la decisión del usuario.
 *
 * `abogadoId` no es decorativo: es la confirmación humana que el wrapper de Google
 * exige para poder borrar. Sin ella, el borrado en Google tira error.
 */
export const resolver = async (firmaId, incidenciaId, { resolucion, abogadoId }) => {
  const cuenta = await prisma.googleCuenta.findUnique({ where: { firmaId } });
  if (!cuenta) throw new NotFoundError('No hay una cuenta de Google conectada.');

  const incidencia = await prisma.syncIncidencia.findFirst({
    where: { id: incidenciaId, cuentaId: cuenta.id },
    include: { link: true },
  });
  if (!incidencia) throw new NotFoundError('Incidencia no encontrada.');
  if (incidencia.estado !== 'PENDIENTE') throw new AppError('Esa incidencia ya fue resuelta.', 409);

  const permitidas = RESOLUCIONES[incidencia.tipo] || ['IGNORAR'];
  if (!permitidas.includes(resolucion)) {
    throw new ValidationError(`Resolución inválida. Opciones: ${permitidas.join(', ')}.`);
  }

  const api = await clienteParaCuenta(cuenta);
  const link = incidencia.link;
  let detalle;

  switch (`${incidencia.tipo}:${resolucion}`) {
    // ── Conflicto: gana GestarLex ─────────────────────────────────────────────
    case 'CONFLICTO:GESTARLEX': {
      const adaptador = ADAPTADORES[link.tipoLocal];
      const registro = await prisma[adaptador.modelo].findUnique({
        where: { id: link.localId },
        include: adaptador.incluir,
      });
      if (!registro) throw new AppError('El registro local ya no existe.', 409);

      const evento = construirEvento(link.tipoLocal, registro, firmaId);
      // Sin If-Match: es una sobrescritura deliberada, ya decidida por el usuario.
      const { data } = await api.actualizar(link.googleEventId, evento);
      await prisma.calendarLink.update({
        where: { id: link.id },
        data: {
          hashLocal: hashContenido(evento),
          etagGoogle: data.etag,
          updatedGoogle: data.updated ? new Date(data.updated) : null,
          estado: 'OK',
          ultimoSyncEn: new Date(),
        },
      });
      detalle = 'Se sobrescribió el evento en Google con la versión de GestarLex.';
      break;
    }

    // ── Conflicto: gana Google ────────────────────────────────────────────────
    case 'CONFLICTO:GOOGLE': {
      const adaptador = ADAPTADORES[link.tipoLocal];
      const { data: evento } = await api.obtener(link.googleEventId);

      await prisma[adaptador.modelo].update({
        where: { id: link.localId },
        data: adaptador.desdeEvento(evento),
      });

      const actualizado = await prisma[adaptador.modelo].findUnique({
        where: { id: link.localId },
        include: adaptador.incluir,
      });
      await prisma.calendarLink.update({
        where: { id: link.id },
        data: {
          hashLocal: hashContenido(construirEvento(link.tipoLocal, actualizado, firmaId)),
          etagGoogle: evento.etag,
          updatedGoogle: evento.updated ? new Date(evento.updated) : null,
          estado: 'OK',
          ultimoSyncEn: new Date(),
        },
      });
      detalle = 'Se aplicó en GestarLex la versión de Google.';
      break;
    }

    // ── Borrado en Google: confirmado, se borra también acá ───────────────────
    case 'BORRADO_EN_GOOGLE:BORRAR_LOCAL': {
      const adaptador = ADAPTADORES[link.tipoLocal];
      if (link.tipoLocal === 'EXTERNO') {
        await prisma.eventoExterno.deleteMany({ where: { id: link.localId } });
      } else {
        await prisma[adaptador.modelo].deleteMany({ where: { id: link.localId } });
      }
      await prisma.calendarLink.delete({ where: { id: link.id } });
      detalle = 'Se borró el registro en GestarLex, confirmado por el usuario.';
      break;
    }

    // ── Borrado en Google: fue un error, se vuelve a crear ────────────────────
    case 'BORRADO_EN_GOOGLE:RESTAURAR_EN_GOOGLE': {
      await prisma.calendarLink.delete({ where: { id: link.id } });
      const r = await empujarRegistro(cuenta, link.tipoLocal, link.localId, { cliente: api });
      detalle = `Se volvió a crear el evento en Google (${r.accion}).`;
      break;
    }

    // ── Borrado en GestarLex: confirmado, se borra el evento de Google ────────
    case 'BORRADO_EN_GESTARLEX:BORRAR_EN_GOOGLE': {
      // El wrapper exige confirmadoPorId: es la barrera final contra un borrado
      // automático que se haya colado por algún camino.
      await api.borrarConfirmadoPorUsuario(link.googleEventId, { confirmadoPorId: abogadoId });
      await prisma.calendarLink.delete({ where: { id: link.id } });
      detalle = 'Se borró el evento en Google, confirmado por el usuario.';
      break;
    }

    // ── Ignorar: se descongela el link y se sigue sincronizando ───────────────
    default: {
      if (link) {
        await prisma.calendarLink.update({
          where: { id: link.id },
          data: { estado: 'OK', hashLocal: null }, // hash nulo = revalidar en la próxima pasada
        });
      }
      detalle = 'Incidencia ignorada. No se modificó nada en ninguno de los dos lados.';
    }
  }

  return prisma.syncIncidencia.update({
    where: { id: incidencia.id },
    data: {
      estado: resolucion === 'IGNORAR' ? 'DESCARTADA' : 'RESUELTA',
      resolucion,
      resueltaEn: new Date(),
      resueltaPorId: abogadoId,
      detalle: `${incidencia.detalle || ''}\n→ ${detalle}`.trim(),
    },
  });
};
