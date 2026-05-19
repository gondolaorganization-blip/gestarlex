import * as svc from '../services/plantillas.service.js';
import { ok } from '../utils/response.js';
import { NotFoundError, AppError } from '../utils/errors.js';

export const listar = (_req, res) => {
  ok(res, svc.listar());
};

export const obtener = (req, res) => {
  const plantilla = svc.obtener(req.params.id);
  if (!plantilla) throw new NotFoundError('Plantilla no encontrada.');
  ok(res, plantilla);
};

export const renderizar = (req, res) => {
  const { variables } = req.body;
  if (!variables || typeof variables !== 'object') {
    throw new AppError('Se requiere un objeto "variables".', 400);
  }
  const resultado = svc.renderizar(req.params.id, variables);
  if (!resultado) throw new NotFoundError('Plantilla no encontrada.');
  ok(res, resultado);
};
