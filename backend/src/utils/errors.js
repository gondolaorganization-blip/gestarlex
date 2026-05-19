export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Datos inválidos', errors = null) {
    super(message, 422);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflicto con datos existentes') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

export class SubscriptionError extends AppError {
  constructor(message = 'Suscripción requerida', errorCode = 'SUBSCRIPTION_REQUIRED') {
    super(message, 402);
    this.name = 'SubscriptionError';
    this.errorCode = errorCode;
  }
}
