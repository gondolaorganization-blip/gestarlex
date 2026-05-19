import { z } from 'zod';
import prisma from '../lib/prisma.js';
import * as svc from '../services/ia.service.js';
import { ok } from '../utils/response.js';
import { ValidationError } from '../utils/errors.js';

const consultaSchema = z.object({
  mensaje:           z.string().min(1, 'El mensaje no puede estar vacío.').max(4000, 'Mensaje demasiado largo.'),
  casoId:            z.string().optional(),
  incluirDocumentos: z.boolean().optional().default(false),
  historial:         z.array(z.object({
    rol:       z.enum(['user', 'assistant']),
    contenido: z.string(),
  })).max(40).optional(),
});

const AI_LIMITS = { SOLO: 100, FIRMA: 500, ENTERPRISE: -1 };

export const getUso = async (req, res) => {
  const firma = await prisma.firma.findUnique({
    where: { id: req.user.firmaId },
    select: { plan: true, aiConsultasMes: true, aiConsultasResetEn: true },
  });
  const limite = AI_LIMITS[firma?.plan] ?? 100;
  ok(res, {
    consultasUsadas: firma?.aiConsultasMes ?? 0,
    limite,
    resetEn: firma?.aiConsultasResetEn ?? null,
  });
};

export const consultar = async (req, res) => {
  const result = consultaSchema.safeParse(req.body);
  if (!result.success) {
    throw new ValidationError('Datos inválidos.', result.error.flatten().fieldErrors);
  }
  const data = await svc.consultar({
    ...result.data,
    firmaId: req.user.firmaId,
  });
  ok(res, data);
};
