import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── TRANSPORTER ─────────────────────────────────────────────────────────────

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

// ─── TEMPLATES HTML ───────────────────────────────────────────────────────────

const baseLayout = (titulo, contenido, firma) => `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;color:#374151}
  .wrap{max-width:560px;margin:30px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
  .head{background:#4F46E5;padding:28px 32px;text-align:left}
  .head h1{margin:0;color:#fff;font-size:20px;font-weight:700}
  .head p{margin:4px 0 0;color:rgba(255,255,255,.75);font-size:13px}
  .body{padding:28px 32px}
  .body h2{margin:0 0 16px;font-size:16px;color:#1F2937}
  .body p{margin:8px 0;font-size:14px;line-height:1.6;color:#4B5563}
  .detail{background:#F9FAFB;border-radius:8px;padding:16px;margin:16px 0}
  .detail .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #E5E7EB}
  .detail .row:last-child{border-bottom:none}
  .detail .lbl{font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
  .detail .val{font-size:13px;color:#1F2937;font-weight:500}
  .badge{display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600}
  .badge-green{background:#D1FAE5;color:#065F46}
  .badge-blue{background:#DBEAFE;color:#1E40AF}
  .badge-yellow{background:#FEF3C7;color:#92400E}
  .badge-red{background:#FEE2E2;color:#991B1B}
  .foot{background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB}
  .foot p{margin:0;font-size:11px;color:#9CA3AF;text-align:center;line-height:1.6}
  a{color:#4F46E5}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>${firma?.nombre ?? 'Gestarlex'}</h1>
    <p>Sistema de Gestión Legal · República de Panamá</p>
  </div>
  <div class="body">
    <h2>${titulo}</h2>
    ${contenido}
  </div>
  <div class="foot">
    <p>Este mensaje fue generado automáticamente por <strong>Gestarlex</strong>.<br>
    Si no esperabas este correo, puedes ignorarlo.<br>
    © ${new Date().getFullYear()} ${firma?.nombre ?? 'Gestarlex'} · Panamá</p>
  </div>
</div>
</body>
</html>
`;

export const templates = {
  tareaCompletada: ({ caso, tarea, firma }) => ({
    asunto: `✅ Tarea completada — Expediente ${caso.numero}`,
    html: baseLayout(
      'Tarea completada',
      `<p>Le informamos que se ha completado la siguiente tarea en su expediente:</p>
       <div class="detail">
         <div class="row"><span class="lbl">Expediente</span><span class="val">${caso.numero} — ${caso.titulo}</span></div>
         <div class="row"><span class="lbl">Tarea</span><span class="val">${tarea.descripcion}</span></div>
         <div class="row"><span class="lbl">Estado</span><span class="val"><span class="badge badge-green">Completada</span></span></div>
         <div class="row"><span class="lbl">Fecha</span><span class="val">${new Date().toLocaleDateString('es-PA', { dateStyle: 'long' })}</span></div>
       </div>
       <p>El equipo legal continúa trabajando en su caso. Si tiene alguna consulta, no dude en contactarnos.</p>`,
      firma
    ),
  }),

  nuevaAudiencia: ({ caso, audiencia, firma }) => ({
    asunto: `📅 Nueva audiencia programada — Expediente ${caso.numero}`,
    html: baseLayout(
      'Nueva audiencia programada',
      `<p>Se ha registrado una nueva audiencia en su expediente:</p>
       <div class="detail">
         <div class="row"><span class="lbl">Expediente</span><span class="val">${caso.numero} — ${caso.titulo}</span></div>
         <div class="row"><span class="lbl">Tipo</span><span class="val">${audiencia.tipo ?? 'Audiencia'}</span></div>
         <div class="row"><span class="lbl">Fecha</span><span class="val">${new Date(audiencia.fecha).toLocaleDateString('es-PA', { dateStyle: 'full' })}</span></div>
         ${audiencia.hora ? `<div class="row"><span class="lbl">Hora</span><span class="val">${audiencia.hora}</span></div>` : ''}
         ${caso.juzgado ? `<div class="row"><span class="lbl">Juzgado</span><span class="val">${caso.juzgado}</span></div>` : ''}
       </div>
       <p>Le recomendamos presentarse con anticipación. Si necesita reagendar o tiene preguntas, comuníquese con nosotros.</p>`,
      firma
    ),
  }),

  nuevoTermino: ({ caso, termino, firma }) => ({
    asunto: `⏰ Nuevo término procesal — Expediente ${caso.numero}`,
    html: baseLayout(
      'Nuevo término procesal registrado',
      `<p>Se ha registrado un nuevo término procesal en su expediente:</p>
       <div class="detail">
         <div class="row"><span class="lbl">Expediente</span><span class="val">${caso.numero} — ${caso.titulo}</span></div>
         <div class="row"><span class="lbl">Descripción</span><span class="val">${termino.descripcion}</span></div>
         <div class="row"><span class="lbl">Vencimiento</span><span class="val"><span class="badge badge-yellow">${new Date(termino.fechaVence).toLocaleDateString('es-PA', { dateStyle: 'long' })}</span></span></div>
         ${termino.prioridad ? `<div class="row"><span class="lbl">Prioridad</span><span class="val">${termino.prioridad}</span></div>` : ''}
       </div>
       <p>Estamos atentos al cumplimiento de este plazo. Si tiene alguna consulta sobre el proceso, estamos a su disposición.</p>`,
      firma
    ),
  }),

  facturaEnviada: ({ factura, cliente, firma }) => ({
    asunto: `🧾 Factura ${factura.numero} — ${new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format(factura.monto).replace('$', 'B/.')}`,
    html: baseLayout(
      'Nueva factura emitida',
      `<p>Estimado/a <strong>${cliente.nombre}</strong>,</p>
       <p>Le enviamos la siguiente factura de honorarios profesionales por los servicios legales prestados:</p>
       <div class="detail">
         <div class="row"><span class="lbl">N° Factura</span><span class="val"><strong>${factura.numero}</strong></span></div>
         <div class="row"><span class="lbl">Fecha</span><span class="val">${new Date(factura.fecha).toLocaleDateString('es-PA', { dateStyle: 'long' })}</span></div>
         ${factura.vence ? `<div class="row"><span class="lbl">Vencimiento</span><span class="val">${new Date(factura.vence).toLocaleDateString('es-PA', { dateStyle: 'long' })}</span></div>` : ''}
         <div class="row"><span class="lbl">Total a pagar</span><span class="val" style="font-size:16px;font-weight:700;color:#4F46E5">B/. ${Number(factura.monto).toFixed(2)}</span></div>
         <div class="row"><span class="lbl">Estado</span><span class="val"><span class="badge badge-blue">Pendiente de pago</span></span></div>
       </div>
       ${factura.notas ? `<p><em>${factura.notas}</em></p>` : ''}
       <p>Para consultas sobre esta factura, comuníquese con nuestra oficina.</p>`,
      firma
    ),
  }),

  recordatorioAudiencia: ({ caso, audiencia, firma }) => ({
    asunto: `🔔 Recordatorio: Audiencia mañana — Expediente ${caso.numero}`,
    html: baseLayout(
      'Recordatorio de audiencia',
      `<p>Le recordamos que mañana tiene una audiencia programada:</p>
       <div class="detail">
         <div class="row"><span class="lbl">Expediente</span><span class="val">${caso.numero} — ${caso.titulo}</span></div>
         <div class="row"><span class="lbl">Tipo</span><span class="val">${audiencia.tipo ?? 'Audiencia'}</span></div>
         <div class="row"><span class="lbl">Fecha</span><span class="val"><strong>${new Date(audiencia.fecha).toLocaleDateString('es-PA', { dateStyle: 'full' })}</strong></span></div>
         ${audiencia.hora ? `<div class="row"><span class="lbl">Hora</span><span class="val"><strong>${audiencia.hora}</strong></span></div>` : ''}
         ${caso.juzgado ? `<div class="row"><span class="lbl">Juzgado</span><span class="val">${caso.juzgado}</span></div>` : ''}
       </div>
       <p>Por favor, preséntese con anticipación y con todos los documentos necesarios. Nuestro equipo estará presente para representarle.</p>`,
      firma
    ),
  }),

  cotizacionEnviada: ({ referencia, servicios, totales, notas, firma, destinatarioNombre }) => {
    const fmt = (n) => `B/. ${Number(n).toFixed(2)}`;
    const filas = servicios.map((s) =>
      `<div class="row">
         <span class="lbl" style="max-width:55%;text-transform:none;letter-spacing:0">${s.descripcion}</span>
         <span class="val">${s.cantidad > 1 ? `${s.cantidad} × ${fmt(s.tarifa)}` : fmt(s.tarifa)}</span>
       </div>`
    ).join('');
    const ajusteRow = totales.ajuste !== 0
      ? `<div class="row"><span class="lbl" style="text-transform:none">Ajuste</span><span class="val">${totales.ajuste > 0 ? '+' : ''}${fmt(totales.ajuste)}</span></div>`
      : '';
    return {
      asunto: `📋 Cotización de honorarios${referencia ? ` — ${referencia}` : ''}`,
      html: baseLayout(
        'Cotización de honorarios profesionales',
        `<p>Estimado/a${destinatarioNombre ? ` <strong>${destinatarioNombre}</strong>` : ''},</p>
         <p>Le presentamos la siguiente cotización de honorarios profesionales por los servicios legales:</p>
         ${referencia ? `<p style="font-size:12px;color:#6B7280">Referencia: <strong>${referencia}</strong></p>` : ''}
         <div class="detail">
           ${filas}
           ${totales.subtotalH > 0 ? `<div class="row"><span class="lbl" style="text-transform:none">Subtotal honorarios</span><span class="val">${fmt(totales.subtotalH)}</span></div>` : ''}
           ${totales.subtotalG > 0 ? `<div class="row"><span class="lbl" style="text-transform:none">Gastos estimados</span><span class="val">${fmt(totales.subtotalG)}</span></div>` : ''}
           ${ajusteRow}
           <div class="row"><span class="lbl" style="text-transform:none;font-weight:700">Total estimado</span><span class="val" style="font-size:15px;font-weight:700;color:#4F46E5">${fmt(totales.total)}</span></div>
         </div>
         ${notas ? `<p style="font-size:13px;color:#4B5563;font-style:italic">${notas}</p>` : ''}
         <p style="font-size:12px;color:#9CA3AF">Esta cotización es un estimado referencial. Los honorarios finales pueden variar según el desarrollo del caso.</p>`,
        firma
      ),
    };
  },

  alertaTermino: ({ caso, termino, firma, diasRestantes }) => ({
    asunto: `⚠️ Alerta: Término vence en ${diasRestantes} días — ${caso.numero}`,
    html: baseLayout(
      `Término procesal próximo a vencer`,
      `<p>Este es un aviso interno: el siguiente término procesal vence en <strong>${diasRestantes} días</strong>:</p>
       <div class="detail">
         <div class="row"><span class="lbl">Expediente</span><span class="val">${caso.numero} — ${caso.titulo}</span></div>
         <div class="row"><span class="lbl">Término</span><span class="val">${termino.descripcion}</span></div>
         <div class="row"><span class="lbl">Vencimiento</span><span class="val"><span class="badge badge-red">${new Date(termino.fechaVence).toLocaleDateString('es-PA', { dateStyle: 'long' })}</span></span></div>
         ${termino.prioridad ? `<div class="row"><span class="lbl">Prioridad</span><span class="val">${termino.prioridad}</span></div>` : ''}
       </div>
       <p><strong>Acción requerida:</strong> Verificar el cumplimiento de este plazo procesal antes de la fecha de vencimiento.</p>`,
      firma
    ),
  }),
};

// ─── ENVIAR EMAIL ─────────────────────────────────────────────────────────────

export async function enviarEmail({ firmaId, casoId = null, tipo, asunto, html, destinatario }) {
  const log = await prisma.emailLog.create({
    data: { firmaId, casoId, tipo, asunto, destinatario, enviado: false },
  });

  const transporter = getTransporter();
  if (!transporter) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { error: 'SMTP no configurado' },
    });
    return { enviado: false, motivo: 'SMTP no configurado' };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  try {
    await transporter.sendMail({ from, to: destinatario, subject: asunto, html });
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { enviado: true, fechaEnvio: new Date() },
    });
    return { enviado: true };
  } catch (err) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { error: err.message?.slice(0, 200) },
    });
    console.error('[email] Error al enviar:', err.message);
    return { enviado: false, motivo: err.message };
  }
}

// ─── OBTENER LOGS POR CASO ────────────────────────────────────────────────────

export async function getLogsPorCaso(casoId, firmaId) {
  return prisma.emailLog.findMany({
    where: { casoId, firmaId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}
