import { ZONA_HORARIA, googleEventIdDeterminista } from './googleCalendar.js';

/**
 * Traducción entre los modelos de GestarLex y los eventos de Google Calendar.
 *
 * Cada entidad sincronizable declara acá cómo se convierte en evento y qué acepta
 * de vuelta cuando el evento se edita en Google. El motor de sync no sabe nada de
 * Audiencia/Termino/Tarea: solo consulta este mapa. Agregar una entidad nueva es
 * agregar una entrada, no tocar el motor.
 */

// ─── FECHAS ───────────────────────────────────────────────────────────────────

/**
 * Día en formato YYYY-MM-DD.
 *
 * Usa toISOString() a propósito, igual que calendario.service.js: es la convención
 * con la que el calendario de GestarLex ya agrupa los días. Si acá calculara el día
 * en hora de Panamá, un evento podría caer un día distinto en Google que en la app,
 * y esa incoherencia sería peor que la imprecisión teórica.
 */
export const fechaISO = (fecha) => new Date(fecha).toISOString().split('T')[0];

/** "09:00" → { hora: 9, minuto: 0 }; null si el formato no es reconocible. */
const parsearHora = (hora) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hora || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { hora: h, minuto: min };
};

const dosDigitos = (n) => String(n).padStart(2, '0');

/** Evento de día completo. En Google el `end.date` es exclusivo: hay que sumar 1 día. */
const diaCompleto = (fecha) => {
  const inicio = fechaISO(fecha);
  const siguiente = new Date(`${inicio}T00:00:00Z`);
  siguiente.setUTCDate(siguiente.getUTCDate() + 1);
  return { start: { date: inicio }, end: { date: fechaISO(siguiente) } };
};

/** Evento con hora, anclado a America/Panama. Duración por defecto: 1 hora. */
const conHora = (fecha, hora, duracionMin = 60) => {
  const t = parsearHora(hora);
  if (!t) return diaCompleto(fecha); // sin hora válida, se comporta como día completo

  const dia = fechaISO(fecha);
  const finMin = t.hora * 60 + t.minuto + duracionMin;
  // Si la duración cruza medianoche, se recorta al final del día para no
  // desplazar la fecha del evento.
  const finTotal = Math.min(finMin, 23 * 60 + 59);

  return {
    start: { dateTime: `${dia}T${dosDigitos(t.hora)}:${dosDigitos(t.minuto)}:00`, timeZone: ZONA_HORARIA },
    end: {
      dateTime: `${dia}T${dosDigitos(Math.floor(finTotal / 60))}:${dosDigitos(finTotal % 60)}:00`,
      timeZone: ZONA_HORARIA,
    },
  };
};

/**
 * Lee la fecha de un evento de Google, venga como día completo o con hora.
 *
 * El día y la hora se calculan EN LA ZONA DEL EVENTO, no en UTC, y la fecha se
 * devuelve normalizada a medianoche UTC — que es como GestarLex guarda `fecha` y
 * `fechaVence`, con la hora aparte en su propio campo.
 *
 * Sin esto pasan dos cosas malas: una audiencia de las 20:00 en Panamá (01:00 UTC
 * del día siguiente) se correría un día al volver, y la fecha regresaría con hora
 * incrustada, lo que haría que cada sync detectara un cambio inexistente y
 * escribiera de nuevo para siempre.
 */
export const fechaDeEvento = (evento) => {
  const s = evento?.start || {};

  if (s.date) {
    return { fecha: new Date(`${s.date}T00:00:00Z`), hora: null, todoElDia: true };
  }

  if (s.dateTime) {
    const zona = s.timeZone || ZONA_HORARIA;
    const partes = Object.fromEntries(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: zona,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
        .formatToParts(new Date(s.dateTime))
        .filter((p) => p.type !== 'literal')
        .map((p) => [p.type, p.value])
    );

    // Intl puede devolver "24" para la medianoche en algunos entornos.
    const hh = partes.hour === '24' ? '00' : partes.hour;

    return {
      fecha: new Date(`${partes.year}-${partes.month}-${partes.day}T00:00:00Z`),
      hora: `${hh}:${partes.minute}`,
      todoElDia: false,
    };
  }

  return { fecha: null, hora: null, todoElDia: false };
};

// ─── MARCADO DE PROPIEDAD ─────────────────────────────────────────────────────

/**
 * Marca el evento como originado en GestarLex. Sobrevive a que le cambien el
 * título en Google, así que es la forma confiable de distinguir "evento nuestro
 * que editaron" de "evento que el usuario creó a mano".
 */
export const propiedadesGestarLex = (tipoLocal, localId, firmaId) => ({
  private: { glxTipo: tipoLocal, glxId: localId, glxFirma: firmaId },
});

export const esDeGestarLex = (evento) => Boolean(evento?.extendedProperties?.private?.glxId);

export const origenGestarLex = (evento) => {
  const p = evento?.extendedProperties?.private;
  return p?.glxId ? { tipoLocal: p.glxTipo, localId: p.glxId, firmaId: p.glxFirma } : null;
};

// ─── DESCRIPCIÓN ──────────────────────────────────────────────────────────────

const lineaCaso = (caso) =>
  caso ? `Caso ${caso.numero} — ${caso.titulo}` : null;

const construirDescripcion = (partes) =>
  partes.filter(Boolean).join('\n') +
  '\n\n— Sincronizado desde GestarLex. Podés editar el título, la fecha y la hora ' +
  'acá; los cambios vuelven a GestarLex.';

// ─── SEMÁFORO (términos) ──────────────────────────────────────────────────────

const EMOJI_ESTADO = {
  VENCIDO: '🔴',
  COMPLETADO: '✅',
  PENDIENTE: '⚖️',
};

// ─── ADAPTADORES ──────────────────────────────────────────────────────────────

export const ADAPTADORES = {
  AUDIENCIA: {
    modelo: 'audiencia',
    etiqueta: 'Audiencia',
    campoFecha: 'fecha',
    // Filtro para encontrar los registros de una firma
    dondeFirma: (firmaId) => ({ caso: { firmaId } }),
    incluir: { caso: { select: { id: true, numero: true, titulo: true, firmaId: true } } },
    firmaDe: (r) => r.caso?.firmaId,

    aEvento: (a) => ({
      summary: `⚖️ ${a.titulo}`,
      location: [a.juzgado, a.sala].filter(Boolean).join(' — ') || undefined,
      description: construirDescripcion([
        lineaCaso(a.caso),
        a.tipo ? `Tipo: ${a.tipo}` : null,
        a.estado ? `Estado: ${a.estado}` : null,
        a.notas,
      ]),
      ...conHora(a.fecha, a.hora),
    }),

    // Qué se acepta de vuelta si el evento se edita en Google.
    desdeEvento: (evento) => {
      const { fecha, hora } = fechaDeEvento(evento);
      return {
        ...(evento.summary && { titulo: evento.summary.replace(/^⚖️\s*/, '') }),
        ...(fecha && { fecha }),
        ...(hora !== undefined && { hora }),
      };
    },
  },

  TERMINO: {
    modelo: 'terminoProcesal',
    etiqueta: 'Término procesal',
    campoFecha: 'fechaVence',
    dondeFirma: (firmaId) => ({ caso: { firmaId } }),
    incluir: { caso: { select: { id: true, numero: true, titulo: true, firmaId: true } } },
    firmaDe: (r) => r.caso?.firmaId,

    aEvento: (t) => ({
      summary: `${EMOJI_ESTADO[t.estado] || '⚖️'} Vence: ${t.descripcion}`,
      description: construirDescripcion([
        lineaCaso(t.caso),
        `Prioridad: ${t.prioridad}`,
        `Estado: ${t.estado}`,
        t.notas,
      ]),
      ...diaCompleto(t.fechaVence),
    }),

    desdeEvento: (evento) => {
      const { fecha } = fechaDeEvento(evento);
      return {
        ...(evento.summary && {
          descripcion: evento.summary.replace(/^[^\s]*\s*Vence:\s*/u, '').trim(),
        }),
        ...(fecha && { fechaVence: fecha }),
      };
    },
  },

  TAREA: {
    modelo: 'tarea',
    etiqueta: 'Tarea',
    campoFecha: 'fechaLimite',
    // Solo las tareas que tienen fecha límite tienen sentido en un calendario.
    dondeFirma: (firmaId) => ({ caso: { firmaId }, fechaLimite: { not: null } }),
    incluir: {
      caso: { select: { id: true, numero: true, titulo: true, firmaId: true } },
      abogado: { select: { nombre: true } },
    },
    firmaDe: (r) => r.caso?.firmaId,

    aEvento: (t) => ({
      summary: `📋 ${t.descripcion}`,
      description: construirDescripcion([
        lineaCaso(t.caso),
        t.abogado ? `Asignada a: ${t.abogado.nombre}` : null,
        `Prioridad: ${t.prioridad}`,
        `Estado: ${t.estado}`,
        t.notas,
      ]),
      ...diaCompleto(t.fechaLimite),
    }),

    desdeEvento: (evento) => {
      const { fecha } = fechaDeEvento(evento);
      return {
        ...(evento.summary && { descripcion: evento.summary.replace(/^📋\s*/, '') }),
        ...(fecha && { fechaLimite: fecha }),
      };
    },
  },
};

export const tiposSincronizables = Object.keys(ADAPTADORES);

/** Construye el recurso completo de Google, ya con ID determinístico y marcado. */
export const construirEvento = (tipoLocal, registro, firmaId) => {
  const adaptador = ADAPTADORES[tipoLocal];
  if (!adaptador) throw new Error(`Tipo no sincronizable: ${tipoLocal}`);

  return {
    id: googleEventIdDeterminista(tipoLocal, registro.id),
    ...adaptador.aEvento(registro),
    extendedProperties: propiedadesGestarLex(tipoLocal, registro.id, firmaId),
  };
};
