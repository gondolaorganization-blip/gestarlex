import prisma from '../lib/prisma.js';
import { ForbiddenError, SubscriptionError } from '../utils/errors.js';

/**
 * Verifica que la firma del usuario autenticado tenga acceso activo al sistema.
 *
 * Permite el acceso si:
 *   1. accessManual === true  (otorgado manualmente por super admin)
 *   2. suscripcionEstado === 'ACTIVO'
 *   3. suscripcionEstado === 'TRIAL' y trialEndsAt es una fecha futura
 *
 * En todos los demás casos devuelve 403 con un mensaje diferenciado según el estado.
 *
 * Adjunta req.firma para que los controladores no necesiten volver a consultar el estado.
 */
export const verificarAcceso = async (req, _res, next) => {
  try {
    const { firmaId } = req.user;

    const firma = await prisma.firma.findUnique({
      where: { id: firmaId },
      select: {
        id: true,
        activa: true,
        suscripcionEstado: true,
        trialEndsAt: true,
        suscripcionVenceEn: true,
        accessManual: true,
      },
    });

    if (!firma || !firma.activa) {
      throw new ForbiddenError('Firma no encontrada o desactivada.');
    }

    // Acceso manual otorgado por super admin — pasa siempre
    if (firma.accessManual) {
      req.firma = firma;
      return next();
    }

    const ahora = new Date();

    if (firma.suscripcionEstado === 'ACTIVO') {
      req.firma = firma;
      return next();
    }

    if (firma.suscripcionEstado === 'TRIAL') {
      if (firma.trialEndsAt && firma.trialEndsAt > ahora) {
        req.firma = firma;
        return next();
      }
      throw new SubscriptionError(
        'El período de prueba ha expirado. Activa tu suscripción para continuar.',
        'TRIAL_EXPIRED',
      );
    }

    if (firma.suscripcionEstado === 'SUSPENDIDO') {
      throw new SubscriptionError(
        'La suscripción está suspendida. Revisa tu método de pago o contacta soporte.',
        'SUBSCRIPTION_SUSPENDED',
      );
    }

    // VENCIDO u otro estado no contemplado
    throw new SubscriptionError(
      'La suscripción ha vencido. Renueva tu plan para acceder al sistema.',
      'SUBSCRIPTION_EXPIRED',
    );
  } catch (err) {
    next(err);
  }
};
