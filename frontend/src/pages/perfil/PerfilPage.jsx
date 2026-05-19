import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { actualizarAbogado } from '../../api/abogados';
import { cambiarPassword, logoutTodos } from '../../api/auth';
import toast from 'react-hot-toast';
import {
  User, Mail, Phone, Scale, Building2,
  Lock, LogOut, Shield, CheckCircle, Eye, EyeOff,
} from 'lucide-react';

const ROL_LABEL = {
  ADMIN:    { label: 'Administrador', cls: 'bg-red-100 text-red-700' },
  SOCIO:    { label: 'Socio',         cls: 'bg-indigo-100 text-indigo-700' },
  ASOCIADO: { label: 'Asociado',      cls: 'bg-blue-100 text-blue-700' },
  PASANTE:  { label: 'Pasante',       cls: 'bg-gray-100 text-gray-600' },
};

const PLAN_LABEL = {
  SOLO:       { label: 'Solo',       cls: 'bg-gray-100 text-gray-600' },
  FIRMA:      { label: 'Firma',      cls: 'bg-indigo-100 text-indigo-700' },
  ENTERPRISE: { label: 'Enterprise', cls: 'bg-amber-100 text-amber-700' },
};

function SectionCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <Icon className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function FieldRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      {Icon && <Icon className="w-4 h-4 text-gray-400 shrink-0" />}
      <span className="text-xs text-gray-500 w-32 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value || <span className="text-gray-400 italic">No especificado</span>}</span>
    </div>
  );
}

export default function PerfilPage() {
  const { user, logout, refreshUser } = useAuth();

  // ── Datos personales ──────────────────────────────────────
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    nombre: user?.nombre ?? '',
    especialidad: user?.especialidad ?? '',
    telefono: user?.telefono ?? '',
  });

  const updateMutation = useMutation({
    mutationFn: (data) => actualizarAbogado(user.id, data),
    onSuccess: async () => {
      await refreshUser();
      setEditando(false);
      toast.success('Perfil actualizado.');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message ?? 'Error al actualizar perfil.');
    },
  });

  const handleSavePerfil = (e) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  const handleCancelEdit = () => {
    setForm({
      nombre: user?.nombre ?? '',
      especialidad: user?.especialidad ?? '',
      telefono: user?.telefono ?? '',
    });
    setEditando(false);
  };

  // ── Cambiar contraseña ────────────────────────────────────
  const [pwForm, setPwForm] = useState({ passwordActual: '', passwordNuevo: '', confirmar: '' });
  const [showPw, setShowPw] = useState({ actual: false, nuevo: false });
  const [pwErrors, setPwErrors] = useState({});

  const cambiarPwMutation = useMutation({
    mutationFn: (data) => cambiarPassword(data),
    onSuccess: async () => {
      toast.success('Contraseña actualizada. Iniciá sesión nuevamente.');
      await logout();
    },
    onError: (err) => {
      toast.error(err.response?.data?.message ?? 'Error al cambiar contraseña.');
    },
  });

  const handleCambiarPw = (e) => {
    e.preventDefault();
    const errs = {};
    if (!pwForm.passwordActual) errs.passwordActual = 'Requerida';
    if (pwForm.passwordNuevo.length < 8) errs.passwordNuevo = 'Mínimo 8 caracteres';
    if (!/[A-Z]/.test(pwForm.passwordNuevo)) errs.passwordNuevo = 'Debe incluir al menos una mayúscula';
    if (!/[0-9]/.test(pwForm.passwordNuevo)) errs.passwordNuevo = 'Debe incluir al menos un número';
    if (pwForm.passwordNuevo !== pwForm.confirmar) errs.confirmar = 'Las contraseñas no coinciden';
    if (Object.keys(errs).length) { setPwErrors(errs); return; }
    setPwErrors({});
    cambiarPwMutation.mutate({
      passwordActual: pwForm.passwordActual,
      passwordNuevo: pwForm.passwordNuevo,
    });
  };

  // ── Cerrar todas las sesiones ─────────────────────────────
  const [confirmLogout, setConfirmLogout] = useState(false);

  const logoutTodosMutation = useMutation({
    mutationFn: logoutTodos,
    onSuccess: async () => {
      toast.success('Todas las sesiones cerradas.');
      await logout();
    },
    onError: () => toast.error('Error al cerrar sesiones.'),
  });

  if (!user) return null;

  const rolMeta = ROL_LABEL[user.rol] ?? { label: user.rol, cls: 'bg-gray-100 text-gray-600' };
  const planMeta = PLAN_LABEL[user.firma?.plan] ?? { label: user.firma?.plan, cls: 'bg-gray-100 text-gray-600' };
  const initiales = user.nombre?.slice(0, 2).toUpperCase() ?? '??';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 text-white text-xl font-bold shrink-0">
              {initiales}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{user.nombre}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rolMeta.cls}`}>
                  {rolMeta.label}
                </span>
                <span className="text-sm text-gray-500">{user.email}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">

        {/* ── Datos de la firma ────────────────────────────────── */}
        <SectionCard title="Firma" icon={Building2}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">{user.firma?.nombre}</p>
              <p className="text-xs text-gray-500 mt-0.5">Firma registrada en GESTARLEX</p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${planMeta.cls}`}>
              Plan {planMeta.label}
            </span>
          </div>
        </SectionCard>

        {/* ── Datos personales ─────────────────────────────────── */}
        <SectionCard title="Datos personales" icon={User}>
          {!editando ? (
            <>
              <FieldRow label="Nombre completo"   value={user.nombre}         icon={User} />
              <FieldRow label="Email"             value={user.email}          icon={Mail} />
              <FieldRow label="No. idoneidad"     value={user.numeroIdoneidad} icon={Scale} />
              <FieldRow label="Especialidad"      value={user.especialidad}   icon={Shield} />
              <FieldRow label="Teléfono"          value={user.telefono}       icon={Phone} />
              <button
                onClick={() => setEditando(true)}
                className="mt-4 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Editar datos
              </button>
            </>
          ) : (
            <form onSubmit={handleSavePerfil} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={form.nombre}
                  onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Especialidad</label>
                <input
                  type="text"
                  value={form.especialidad}
                  onChange={(e) => setForm((p) => ({ ...p, especialidad: e.target.value }))}
                  placeholder="Ej. Derecho Laboral, Derecho Civil…"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm((p) => ({ ...p, telefono: e.target.value }))}
                  placeholder="Ej. +507 6000-0000"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {updateMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </SectionCard>

        {/* ── Cambiar contraseña ───────────────────────────────── */}
        <SectionCard title="Seguridad — Cambiar contraseña" icon={Lock}>
          <form onSubmit={handleCambiarPw} className="space-y-4">
            {/* Contraseña actual */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Contraseña actual</label>
              <div className="relative">
                <input
                  type={showPw.actual ? 'text' : 'password'}
                  value={pwForm.passwordActual}
                  onChange={(e) => setPwForm((p) => ({ ...p, passwordActual: e.target.value }))}
                  className={`w-full text-sm border rounded-lg px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    pwErrors.passwordActual ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => ({ ...p, actual: !p.actual }))}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPw.actual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwErrors.passwordActual && <p className="text-xs text-red-500 mt-1">{pwErrors.passwordActual}</p>}
            </div>

            {/* Nueva contraseña */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={showPw.nuevo ? 'text' : 'password'}
                  value={pwForm.passwordNuevo}
                  onChange={(e) => setPwForm((p) => ({ ...p, passwordNuevo: e.target.value }))}
                  className={`w-full text-sm border rounded-lg px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                    pwErrors.passwordNuevo ? 'border-red-400' : 'border-gray-200'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => ({ ...p, nuevo: !p.nuevo }))}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPw.nuevo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pwErrors.passwordNuevo && <p className="text-xs text-red-500 mt-1">{pwErrors.passwordNuevo}</p>}
              <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres, una mayúscula y un número.</p>
            </div>

            {/* Confirmar */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirmar nueva contraseña</label>
              <input
                type="password"
                value={pwForm.confirmar}
                onChange={(e) => setPwForm((p) => ({ ...p, confirmar: e.target.value }))}
                className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  pwErrors.confirmar ? 'border-red-400' : 'border-gray-200'
                }`}
              />
              {pwErrors.confirmar && <p className="text-xs text-red-500 mt-1">{pwErrors.confirmar}</p>}
            </div>

            <button
              type="submit"
              disabled={cambiarPwMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              {cambiarPwMutation.isPending ? 'Actualizando…' : 'Cambiar contraseña'}
            </button>
          </form>
        </SectionCard>

        {/* ── Sesiones activas ─────────────────────────────────── */}
        <SectionCard title="Sesiones activas" icon={LogOut}>
          <p className="text-sm text-gray-600 mb-4">
            Cerrá sesión en todos los dispositivos donde hayas iniciado sesión con esta cuenta.
            Deberás volver a iniciar sesión después.
          </p>
          {!confirmLogout ? (
            <button
              onClick={() => setConfirmLogout(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar todas las sesiones
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 flex-1">¿Estás seguro? Se cerrarán todas las sesiones activas.</p>
              <button
                onClick={() => logoutTodosMutation.mutate()}
                disabled={logoutTodosMutation.isPending}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors shrink-0"
              >
                {logoutTodosMutation.isPending ? 'Cerrando…' : 'Confirmar'}
              </button>
              <button
                onClick={() => setConfirmLogout(false)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition-colors shrink-0"
              >
                Cancelar
              </button>
            </div>
          )}
        </SectionCard>

      </div>
    </div>
  );
}
