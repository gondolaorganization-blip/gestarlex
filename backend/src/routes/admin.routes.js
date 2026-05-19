import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { adminAuthenticate } from '../middleware/adminAuth.js';
import * as ctrl from '../controllers/admin.controller.js';

const router = Router();

// Pública
router.post('/auth/login', asyncHandler(ctrl.login));

// Protegidas
router.use(adminAuthenticate);

router.get('/auth/me', asyncHandler(ctrl.me));
router.get('/firmas', asyncHandler(ctrl.listarFirmas));
router.get('/firmas/:id', asyncHandler(ctrl.obtenerFirma));
router.patch('/firmas/:id/suscripcion', asyncHandler(ctrl.actualizarSuscripcion));
router.get('/firmas/:id/eventos', asyncHandler(ctrl.listarEventos));

export default router;
