export const ok = (res, data, statusCode = 200) =>
  res.status(statusCode).json({ ok: true, data });

export const created = (res, data) => ok(res, data, 201);

export const noContent = (res) => res.status(204).send();

export const fail = (res, message, statusCode = 400, errors = null) =>
  res.status(statusCode).json({ ok: false, message, ...(errors && { errors }) });

export const unauthorized = (res, message = 'No autenticado') =>
  fail(res, message, 401);

export const forbidden = (res, message = 'Acceso denegado') =>
  fail(res, message, 403);

export const notFound = (res, message = 'Recurso no encontrado') =>
  fail(res, message, 404);

export const serverError = (res, message = 'Error interno del servidor') =>
  fail(res, message, 500);
