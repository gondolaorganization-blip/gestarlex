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
