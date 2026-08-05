import { parseISO } from 'date-fns';

/**
 * Interpreta una fecha del backend como DÍA CALENDARIO, no como instante.
 *
 * El backend guarda los campos que el usuario elige con <input type="date">
 * (fechaVence, fechaLimite, la fecha de una audiencia, etc.) como medianoche UTC.
 * Al hacer parseISO sobre el ISO completo, el navegador los convierte a hora local:
 * en Panamá (UTC-5), la medianoche UTC del día 10 son las 19:00 del día 9, y la
 * pantalla termina mostrando un día menos.
 *
 * Para un despacho eso no es cosmético — un término procesal es un plazo legal, y
 * el semáforo de vencimientos se calcula sobre esta misma fecha.
 *
 * Cortar el ISO a "YYYY-MM-DD" hace que parseISO devuelva medianoche LOCAL, con lo
 * que el día mostrado es siempre el que se eligió, en cualquier zona horaria.
 *
 * NO usar para instantes reales (createdAt, fechaSubida, completadoEn, fechaEnvio):
 * ahí la conversión a hora local es la correcta y esto introduciría el bug inverso.
 */
export const diaCalendario = (iso) => parseISO(String(iso).slice(0, 10));

/**
 * "20:30" → "8:30 p. m."
 *
 * La hora se guarda en 24h (formato estable, sin ambigüedad), pero en Panamá se
 * lee en 12h. Mostrar "20:30" obliga a traducir mentalmente cada vez.
 */
export const formatHora12 = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = String(hhmm).split(':');
  const hora = Number(h);
  if (Number.isNaN(hora) || hora > 23) return String(hhmm);
  const sufijo = hora < 12 ? 'a. m.' : 'p. m.';
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  return `${h12}:${(m ?? '00').padStart(2, '0')} ${sufijo}`;
};

/**
 * Opciones para elegir la hora de una audiencia, de 6:00 a 20:45 cada 15 minutos.
 *
 * Reemplaza al <input type="time"> nativo, que en un Mac configurado en 12 horas
 * muestra un campo de hora con máximo 12: al tipear "20" el input queda inválido y
 * devuelve cadena vacía, de modo que la audiencia se guardaba SIN hora y sin avisar.
 * Un desplegable con etiquetas a. m. / p. m. no tiene esa ambigüedad.
 */
export const opcionesHora = () => {
  const opciones = [];
  for (let h = 6; h <= 20; h++) {
    for (const m of ['00', '15', '30', '45']) {
      const valor = `${String(h).padStart(2, '0')}:${m}`;
      opciones.push({ valor, etiqueta: formatHora12(valor) });
    }
  }
  return opciones;
};
