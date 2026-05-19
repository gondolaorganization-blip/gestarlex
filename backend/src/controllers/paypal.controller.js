import * as paypalService from '../services/paypal.service.js';
import { ok } from '../utils/response.js';

export const getPlanes = async (_req, res) => {
  const planes = paypalService.getPlanes();
  ok(res, planes);
};

export const activarSuscripcion = async (req, res) => {
  const { subscriptionId } = req.body;
  if (!subscriptionId) {
    return res.status(400).json({ ok: false, message: 'subscriptionId requerido.' });
  }
  const firma = await paypalService.activarSuscripcion(req.user.firmaId, subscriptionId);
  ok(res, firma);
};

export const cancelarSuscripcion = async (req, res) => {
  await paypalService.cancelarSuscripcion(req.user.firmaId);
  ok(res, { message: 'Suscripción cancelada.' });
};

export const webhook = async (req, res) => {
  const resultado = await paypalService.procesarWebhook(req.headers, req.rawBody);
  res.status(200).json({ ok: true, ...resultado });
};
