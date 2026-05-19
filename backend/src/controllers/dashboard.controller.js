import * as svc from '../services/dashboard.service.js';
import { ok } from '../utils/response.js';

export const obtener = async (req, res) => {
  const data = await svc.obtenerDashboard(req.user.firmaId, req.user);
  ok(res, data);
};

export const metricas = async (req, res) => {
  const data = await svc.metricas(req.user.firmaId, req.user);
  ok(res, data);
};
