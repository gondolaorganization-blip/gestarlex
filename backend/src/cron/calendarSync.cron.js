import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { traerCambios, empujarTodo } from '../services/calendarSync.service.js';

/**
 * Sincronización periódica con Google Calendar.
 *
 * Solo corre para cuentas ACTIVAS y con el sync completo habilitado, o sea: nunca
 * antes de que la prueba de un evento haya pasado en ambas direcciones.
 *
 * Nada de lo que hace este cron puede borrar un evento ni resolver un conflicto.
 * Lo que necesita decisión humana queda como SyncIncidencia pendiente.
 */

let corriendo = false;

const sincronizarTodasLasFirmas = async () => {
  // Evita que dos corridas se pisen si una tarda más que el intervalo.
  if (corriendo) {
    console.log('[cron:google] La corrida anterior sigue en curso, se saltea esta.');
    return;
  }
  corriendo = true;

  try {
    const cuentas = await prisma.googleCuenta.findMany({
      where: { estado: 'ACTIVA', syncCompletoHabilitado: true },
    });

    if (cuentas.length === 0) return;

    for (const cuenta of cuentas) {
      try {
        const entrada = await traerCambios(cuenta);
        const fresca = await prisma.googleCuenta.findUnique({ where: { id: cuenta.id } });
        const salida = await empujarTodo(fresca);

        const pendientes = await prisma.syncIncidencia.count({
          where: { cuentaId: cuenta.id, estado: 'PENDIENTE' },
        });

        console.log(
          `[cron:google] firma=${cuenta.firmaId} ` +
            `entrada(externos:${entrada.externos_creados} locales:${entrada.locales_actualizados}) ` +
            `salida(creados:${salida.creados} actualizados:${salida.actualizados}) ` +
            `incidencias_pendientes=${pendientes}`
        );
      } catch (err) {
        console.error(`[cron:google] Error en firma ${cuenta.firmaId}:`, err.message);
        await prisma.googleCuenta.update({
          where: { id: cuenta.id },
          data: { ultimoError: err.message.slice(0, 500), ultimoErrorEn: new Date() },
        });
      }
    }
  } finally {
    corriendo = false;
  }
};

export const initCalendarSyncCron = () => {
  // Cada 10 minutos. El pull es incremental (syncToken), así que es barato.
  cron.schedule('*/10 * * * *', sincronizarTodasLasFirmas);
  console.log('[cron] Sync con Google Calendar registrado: cada 10 minutos');
};

export { sincronizarTodasLasFirmas };
