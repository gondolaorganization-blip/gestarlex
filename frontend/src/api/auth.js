import api from './client';

export const login = (email, password) =>
  api.post('/auth/login', { email, password }).then((r) => r.data.data);

export const logout = (refreshToken) =>
  api.post('/auth/logout', { refreshToken });

export const me = () =>
  api.get('/auth/me').then((r) => r.data.data);

export const cambiarPassword = (data) =>
  api.put('/auth/cambiar-password', data).then((r) => r.data.data);

export const logoutTodos = () =>
  api.post('/auth/logout-todos').then((r) => r.data.data);
