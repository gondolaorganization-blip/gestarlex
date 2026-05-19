import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authApi from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarUsuario = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const abogado = await authApi.me();
      setUser(abogado);
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarUsuario();
  }, [cargarUsuario]);

  const login = async (email, password) => {
    const datos = await authApi.login(email, password);
    localStorage.setItem('accessToken', datos.accessToken);
    localStorage.setItem('refreshToken', datos.refreshToken);
    setUser(datos.abogado);
    return datos;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    await authApi.logout(refreshToken).catch(() => {});
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const refreshUser = useCallback(async () => {
    try {
      const abogado = await authApi.me();
      setUser(abogado);
    } catch { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
};
