import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import { enviarEmail, templates } from '../services/email.service.js';

// ─── RECORDATORIO AUDIENCIAS (48h antes) ─────────────────────────────────────

const recordatorioAudiencias = async () => {
  const manana = new Date();
  manana.setDate(manana.getDate() + 1);
  manana.setHours(0, 0, 0, 0);
  const pasadoManana = new Date(manana);
  pasadoManana.setDate(pasadoManana.getDate() + 1);

  const audiencias = await prisma.audiencia.findMany({
    where: {
      estado: 'PENDIENTE',
      fecha: { gte: manana, lt: pasadoManana },
    },
    include: {
      caso: {
        select: {
          id: true, numero: true, titulo: true, firmaId: true, juzgado: true,
          cliente: { select: { email: true } },
          firma: { select: { id: true, nombre: true } },
        },
      },
    },
  });

  for (const audiencia of audiencias) {
    const emailCliente = audiencia.caso.cliente?.email;
    if (!emailCliente) continue;

    // Dedup: verificar si ya se envió hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const yaEnviado = await prisma.emailLog.findFirst({
      where: {
        casoId: audiencia.casoId,
        tipo: 'RECORDATORIO_AUDIENCIA',
        enviado: true,
        fechaEnvio: { gte: hoy },
        destinatario: emailCliente,
      },
    });
    if (yaEnviado) continue;

    const tmpl = templates.recordatorioAudiencia({
      caso: audiencia.caso,
      audiencia,
      firma: audiencia.caso.firma,
    });
    await enviarEmail({
      firmaId: audiencia.caso.firmaId,
      casoId: audiencia.casoId,
      tipo: 'RECORDATORIO_AUDIENCIA',
      asunto: tmpl.asunto,
      html: tmpl.html,
      destinatario: emailCliente,
    });
  }
};

// ─── ALERTA TÉRMINOS (3 días antes — aviso interno a la firma) ────────────────

const alertaTerminos = async () => {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en3dias = new Date(hoy);
  en3dias.setDate(en3dias.getDate() + 3);
  const en4dias = new Date(hoy);
  en4dias.setDate(en4dias.getDate() + 4);

  const terminos = await prisma.terminoProcesal.findMany({
    where: {
      estado: 'PENDIENTE',
      fechaVence: { gte: en3dias, lt: en4dias },
    },
    include: {
      caso: {
        select: {
          id: true, numero: true, titulo: true, firmaId: true,
          firma: { select: { id: true, nombre: true, email: true } },
        },
      },
    },
  });

  for (const termino of terminos) {
    const emailFirma = termino.caso.firma?.email;
    if (!emailFirma) continue;

    const yaEnviado = await prisma.emailLog.findFirst({
      where: {
        casoId: termino.casoId,
        tipo: 'ALERTA_TERMINO',
        enviado: true,
        fechaEnvio: { gte: hoy },
        destinatario: emailFirma,
      },
    });
    if (yaEnviado) continue;

    const tmpl = templates.alertaTermino({
      caso: termino.caso,
      termino,
      firma: termino.caso.firma,
      diasRestantes: 3,
    });
    await enviarEmail({
      firmaId: termino.caso.firmaId,
      casoId: termino.casoId,
      tipo: 'ALERTA_TERMINO',
      asunto: tmpl.asunto,
      html: tmpl.html,
      destinatario: emailFirma,
    });
  }
};

// ─── REGISTRAR JOBS ───────────────────────────────────────────────────────────

export const initCronJobs = () => {
  // Todos los días a las 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Ejecutando recordatorios de audiencias...');
    await recordatorioAudiencias().catch((e) =>
      console.error('[cron] Error recordatorioAudiencias:', e.message)
    );
    console.log('[cron] Ejecutando alertas de términos...');
    await alertaTerminos().catch((e) =>
      console.error('[cron] Error alertaTerminos:', e.message)
    );
  });

  console.log('[cron] Jobs registrados: recordatorios 08:00 diario');
};
