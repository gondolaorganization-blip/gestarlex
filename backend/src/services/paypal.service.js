import prisma from '../lib/prisma.js';
import { paypal } from '../lib/paypal.js';
import { NotFoundError } from '../utils/errors.js';

// Mapeo plan interno → plan PayPal
const PLANES = {
  SOLO:       { nombre: 'SOLO',       precio: 49,  abogados: 1,         label: 'Solo' },
  FIRMA:      { nombre: 'FIRMA',      precio: 99,  abogados: 5,         label: 'Firma' },
  ENTERPRISE: { nombre: 'ENTERPRISE', precio: 199, abogados: Infinity,  label: 'Enterprise' },
};

const paypalPlanId = (plan) => {
  const ids = {
    SOLO:       process.env.PAYPAL_PLAN_ID_SOLO,
    FIRMA:      process.env.PAYPAL_PLAN_ID_FIRMA,
    ENTERPRISE: process.env.PAYPAL_PLAN_ID_ENTERPRISE,
  };
  return ids[plan];
};

// ── Planes ────────────────────────────────────────────────────────────────────

export const getPlanes = () =>
  Object.values(PLANES).map((p) => ({
    ...p,
    paypalPlanId: paypalPlanId(p.nombre),
  }));

// ── Activar suscripción post-aprobación ───────────────────────────────────────

export const activarSuscripcion = async (firmaId, subscriptionId) => {
  const firma = await prisma.firma.findUnique({ where: { id: firmaId } });
  if (!firma) throw new NotFoundError('Firma no encontrada.');

  // Verificar que la suscripción existe y está activa en PayPal
  const sub = await paypal('GET', `/v1/billing/subscriptions/${subscriptionId}`);

  if (!['ACTIVE', 'APPROVED'].includes(sub.status)) {
    throw new Error(`Suscripción PayPal en estado inesperado: ${sub.status}`);
  }

  // Determinar el plan por el plan_id de PayPal
  const planNombre = _planPorPaypalId(sub.plan_id) ?? firma.plan;

  // Calcular próximo vencimiento (un ciclo de facturación)
  const venceEn = new Date();
  venceEn.setMonth(venceEn.getMonth() + 1);

  const [firmaActualizada] = await prisma.$transaction([
    prisma.firma.update({
      where: { id: firmaId },
      data: {
        suscripcionEstado: 'ACTIVO',
        plan: planNombre,
        paypalSubscriptionId: subscriptionId,
        suscripcionVenceEn: venceEn,
        trialEndsAt: null,
      },
    }),
    prisma.suscripcionEvento.create({
      data: {
        firmaId,
        evento: 'ACTIVADA',
        detalle: { subscriptionId, planPaypalId: sub.plan_id, planNombre },
        creadoPor: 'paypal_activacion',
      },
    }),
  ]);

  return firmaActualizada;
};

// ── Webhook ───────────────────────────────────────────────────────────────────

export const procesarWebhook = async (headers, rawBody) => {
  // Verificar firma del webhook con PayPal
  const verificacion = await paypal('POST', '/v1/notifications/verify-webhook-signature', {
    auth_algo:         headers['paypal-auth-algo'],
    cert_url:          headers['paypal-cert-url'],
    client_id:         process.env.PAYPAL_CLIENT_ID,
    transmission_id:   headers['paypal-transmission-id'],
    transmission_sig:  headers['paypal-transmission-sig'],
    transmission_time: headers['paypal-transmission-time'],
    webhook_id:        process.env.PAYPAL_WEBHOOK_ID,
    webhook_event:     JSON.parse(rawBody),
  });

  if (verificacion.verification_status !== 'SUCCESS') {
    const err = new Error('Webhook PayPal no verificado.');
    err.status = 400;
    throw err;
  }

  const evento = JSON.parse(rawBody);
  const { event_type, resource } = evento;
  const subscriptionId = resource?.id ?? resource?.billing_agreement_id;

  if (!subscriptionId) return { ignorado: true, razon: 'sin subscription ID' };

  const firma = await prisma.firma.findFirst({
    where: { paypalSubscriptionId: subscriptionId },
  });

  if (!firma) return { ignorado: true, razon: 'firma no encontrada para esta suscripción' };

  await _aplicarEventoWebhook(firma, event_type, resource, subscriptionId);
  return { procesado: true, evento: event_type };
};

// ── Cancelar suscripción ──────────────────────────────────────────────────────

export const cancelarSuscripcion = async (firmaId) => {
  const firma = await prisma.firma.findUnique({ where: { id: firmaId } });
  if (!firma) throw new NotFoundError('Firma no encontrada.');
  if (!firma.paypalSubscriptionId) throw new Error('Esta firma no tiene suscripción PayPal activa.');

  await paypal('POST', `/v1/billing/subscriptions/${firma.paypalSubscriptionId}/cancel`, {
    reason: 'Cancelada por el usuario.',
  });

  await prisma.$transaction([
    prisma.firma.update({
      where: { id: firmaId },
      data: { suscripcionEstado: 'SUSPENDIDO', paypalSubscriptionId: null },
    }),
    prisma.suscripcionEvento.create({
      data: {
        firmaId,
        evento: 'CANCELADA_POR_USUARIO',
        detalle: { subscriptionId: firma.paypalSubscriptionId },
        creadoPor: 'usuario',
      },
    }),
  ]);
};

// ── Helpers privados ──────────────────────────────────────────────────────────

const _planPorPaypalId = (paypalPlanId) => {
  const mapa = {
    [process.env.PAYPAL_PLAN_ID_SOLO]:       'SOLO',
    [process.env.PAYPAL_PLAN_ID_FIRMA]:      'FIRMA',
    [process.env.PAYPAL_PLAN_ID_ENTERPRISE]: 'ENTERPRISE',
  };
  return mapa[paypalPlanId] ?? null;
};

const _aplicarEventoWebhook = async (firma, eventType, resource, subscriptionId) => {
  const cambios = {};
  let nombreEvento = eventType;

  switch (eventType) {
    case 'BILLING.SUBSCRIPTION.ACTIVATED':
    case 'BILLING.SUBSCRIPTION.RE-ACTIVATED': {
      const venceEn = new Date();
      venceEn.setMonth(venceEn.getMonth() + 1);
      cambios.suscripcionEstado = 'ACTIVO';
      cambios.suscripcionVenceEn = venceEn;
      if (resource?.plan_id) cambios.plan = _planPorPaypalId(resource.plan_id) ?? firma.plan;
      nombreEvento = 'ACTIVADA';
      break;
    }
    case 'BILLING.SUBSCRIPTION.CANCELLED':
      cambios.suscripcionEstado = 'SUSPENDIDO';
      cambios.paypalSubscriptionId = null;
      nombreEvento = 'CANCELADA';
      break;
    case 'BILLING.SUBSCRIPTION.EXPIRED':
      cambios.suscripcionEstado = 'VENCIDO';
      nombreEvento = 'VENCIDA';
      break;
    case 'BILLING.SUBSCRIPTION.SUSPENDED':
      cambios.suscripcionEstado = 'SUSPENDIDO';
      nombreEvento = 'SUSPENDIDA';
      break;
    case 'PAYMENT.SALE.COMPLETED': {
      const venceEn = new Date();
      venceEn.setMonth(venceEn.getMonth() + 1);
      cambios.suscripcionEstado = 'ACTIVO';
      cambios.suscripcionVenceEn = venceEn;
      nombreEvento = 'PAGO_RECIBIDO';
      break;
    }
    default:
      return; // evento no relevante, ignorar sin escribir en DB
  }

  await prisma.$transaction([
    prisma.firma.update({ where: { id: firma.id }, data: cambios }),
    prisma.suscripcionEvento.create({
      data: {
        firmaId: firma.id,
        evento: nombreEvento,
        detalle: { subscriptionId, eventType },
        creadoPor: 'paypal_webhook',
      },
    }),
  ]);
};
