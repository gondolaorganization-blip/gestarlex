import axios from 'axios';

const adminApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || '/api'}/admin`,
  headers: { 'Content-Type': 'application/json' },
});

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('adminToken');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export const adminLogin = (email, password) =>
  adminApi.post('/auth/login', { email, password }).then((r) => r.data.data);

export const adminMe = () =>
  adminApi.get('/auth/me').then((r) => r.data.data);

export const getFirmas = (params) =>
  adminApi.get('/firmas', { params }).then((r) => r.data.data);

export const getFirma = (id) =>
  adminApi.get(`/firmas/${id}`).then((r) => r.data.data);

export const updateSuscripcion = (id, datos) =>
  adminApi.patch(`/firmas/${id}/suscripcion`, datos).then((r) => r.data.data);

export const getEventos = (id) =>
  adminApi.get(`/firmas/${id}/eventos`).then((r) => r.data.data);
