import * as svc from '../services/calendario.service.js';
import { ok } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

export const mensual = async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;

  if (month < 1 || month > 12) throw new ValidationError('Mes inválido (1-12).');

  const data = await svc.mensual(req.user.firmaId, req.user, year, month);
  ok(res, data);
};

export const semanal = async (req, res) => {
  const data = await svc.semanal(req.user.firmaId, req.user, req.query.fecha);
  ok(res, data);
};

export const alertas = async (req, res) => {
  const data = await svc.alertas(req.user.firmaId, req.user);
  ok(res, data);
};
