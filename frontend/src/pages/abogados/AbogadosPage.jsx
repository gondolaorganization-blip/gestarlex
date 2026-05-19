import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAbogados, crearAbogado, actualizarAbogado, desactivarAbogado } from '../../api/abogados';
import { useAuth } from '../../contexts/AuthContext';
import { Briefcase, Plus, X, Mail, Phone, Hash, Star, Edit2, UserX, Eye, EyeOff } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ROL_META = {
  ADMIN:    { label: 'Admin',    bg: 'bg-purple-100', text: 'text-purple-700', avatar: 'bg-purple-200 text-purple-700' },
  SOCIO:    { label: 'Socio',    bg: 'bg-indigo-100', text: 'text-indigo-700', avatar: 'bg-indigo-200 text-indigo-700' },
  ASOCIADO: { label: 'Asociado', bg: 'bg-blue-100',   text: 'text-blue-700',   avatar: 'bg-blue-200 text-blue-700' },
  PASANTE:  { label: 'Pasante',  bg: 'bg-gray-100',   text: 'text-gray-600',   avatar: 'bg-gray-200 text-gray-600' },
};

const ROLES_PERMITIDOS = ['SOCIO', 'ASOCIADO', 'PASANTE'];
const JERARQUIA = { ADMIN: 4, SOCIO: 3, ASOCIADO: 2, PASANTE: 1 };

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function AbogadosPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState('activos');
  const [showAdd, setShowAdd] = useState(false);
  const [editando, setEditando] = useState(null);
  const [confirmDesactivar, setConfirmDesactivar] = useState(null);

  const puedeGestionar = ['ADMIN', 'SOCIO'].includes(user?.rol);

  const { data: abogados = [], isLoading } = useQuery({
    queryKey: ['abogados'],
    queryFn: getAbogados,
  });

  const activos   = abogados.filter((a) => a.activo);
  const inactivos = abogados.filter((a) => !a.activo);
  const lista = tab === 'activos' ? activos : inactivos;

  const mutDesactivar = useMutation({
    mutationFn: desactivarAbogado,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abogados'] });
      toast.success('Abogado desactivado');
      setConfirmDesactivar(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  const resumenRoles = activos.reduce((acc, a) => {
    acc[a.rol] = (acc[a.rol] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Equipo</h1>
                <p className="text-xs text-gray-500">{activos.length} miembro{activos.length !== 1 ? 's' : ''} activo{activos.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {puedeGestionar && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar abogado
              </button>
            )}
          </div>

          {/* Rol breakdown */}
          <div className="flex items-center gap-3 flex-wrap">
            {Object.entries(ROL_META).map(([rol, meta]) => {
              const count = resumenRoles[rol] ?? 0;
              if (count === 0) return null;
              return (
                <span key={rol} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${meta.bg} ${meta.text}`}>
                  {count} {meta.label}{count !== 1 ? 's' : ''}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs */}
        {inactivos.length > 0 && (
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm w-fit mb-5">
            <button
              onClick={() => setTab('activos')}
              className={`px-4 py-2 font-medium transition-colors ${tab === 'activos' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Activos ({activos.length})
            </button>
            <button
              onClick={() => setTab('inactivos')}
              className={`px-4 py-2 font-medium border-l border-gray-200 transition-colors ${tab === 'inactivos' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Inactivos ({inactivos.length})
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : lista.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Briefcase className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{tab === 'activos' ? 'Sin abogados activos' : 'Sin abogados inactivos'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lista.map((a) => {
              const meta = ROL_META[a.rol] ?? ROL_META.PASANTE;
              const esPropioUsuario = a.id === user?.sub;
              const puedeEditar = puedeGestionar || esPropioUsuario;
              const puedeDesact = puedeGestionar && !esPropioUsuario && a.activo;
              const inicial = a.nombre?.charAt(0).toUpperCase() ?? '?';

              return (
                <div
                  key={a.id}
                  className={`bg-white rounded-xl border transition-all hover:shadow-sm ${
                    !a.activo ? 'border-gray-100 opacity-60' : 'border-gray-200'
                  } ${esPropioUsuario ? 'ring-2 ring-indigo-200' : ''}`}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${meta.avatar}`}>
                        {inicial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-gray-900 truncate">{a.nombre}</h3>
                          {esPropioUsuario && (
                            <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">Tú</span>
                          )}
                        </div>
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${meta.bg} ${meta.text}`}>
                          {meta.label}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Hash className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span>Idoneidad: <span className="font-semibold text-gray-700">{a.numeroIdoneidad}</span></span>
                      </div>
                      {a.especialidad && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Star className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                          <span className="truncate">{a.especialidad}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{a.email}</span>
                      </div>
                      {a.telefono && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{a.telefono}</span>
                        </div>
                      )}
                    </div>

                    {(puedeEditar || puedeDesact) && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                        {puedeEditar && (
                          <button
                            onClick={() => setEditando(a)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Editar
                          </button>
                        )}
                        {puedeDesact && (
                          <button
                            onClick={() => setConfirmDesactivar(a)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <UserX className="w-3.5 h-3.5" /> Desactivar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm desactivar */}
      {confirmDesactivar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">¿Desactivar abogado?</h3>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-semibold">{confirmDesactivar.nombre}</span> ya no podrá iniciar sesión, pero su historial de casos se conserva.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDesactivar(null)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button
                onClick={() => mutDesactivar.mutate(confirmDesactivar.id)}
                disabled={mutDesactivar.isPending}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {mutDesactivar.isPending ? 'Desactivando...' : 'Desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <AgregarAbogadoModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['abogados'] }); }}
        />
      )}

      {editando && (
        <EditarAbogadoModal
          abogado={editando}
          puedeGestionar={puedeGestionar}
          onClose={() => setEditando(null)}
          onSuccess={() => { setEditando(null); qc.invalidateQueries({ queryKey: ['abogados'] }); }}
        />
      )}
    </div>
  );
}

// ─── MODAL AGREGAR ABOGADO ────────────────────────────────────────────────────

function AgregarAbogadoModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    nombre: '', numeroIdoneidad: '', email: '', especialidad: '',
    telefono: '', rol: 'ASOCIADO', password: '',
  });
  const [showPass, setShowPass] = useState(false);

  const mutation = useMutation({
    mutationFn: crearAbogado,
    onSuccess: () => { toast.success('Abogado agregado exitosamente'); onSuccess(); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al crear el abogado'),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      nombre: form.nombre,
      numeroIdoneidad: form.numeroIdoneidad,
      email: form.email,
      rol: form.rol,
    };
    if (form.especialidad) payload.especialidad = form.especialidad;
    if (form.telefono) payload.telefono = form.telefono;
    if (form.password) payload.password = form.password;
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Agregar miembro al equipo</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo <span className="text-red-500">*</span></label>
              <input required value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
                placeholder="Ej: Ana Martínez García"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">N.º Idoneidad <span className="text-red-500">*</span></label>
              <input required value={form.numeroIdoneidad} onChange={(e) => set('numeroIdoneidad', e.target.value)}
                placeholder="Ej: 12345"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
              <input value={form.telefono} onChange={(e) => set('telefono', e.target.value)}
                placeholder="Ej: 6000-0000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico <span className="text-red-500">*</span></label>
              <input required type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="abogado@firma.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Especialidad</label>
              <input value={form.especialidad} onChange={(e) => set('especialidad', e.target.value)}
                placeholder="Ej: Derecho Civil, Laboral, Marítimo..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>

          {/* Rol */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Rol</label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES_PERMITIDOS.map((r) => {
                const m = ROL_META[r];
                return (
                  <button key={r} type="button" onClick={() => set('rol', r)}
                    className={`py-2.5 text-xs font-semibold rounded-xl border-2 transition-all ${
                      form.rol === r ? `border-current ${m.bg} ${m.text}` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña inicial</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Dejar vacío para usar contraseña por defecto"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Por defecto: <code className="bg-gray-100 px-1 rounded">Gestarlex2024!</code> — el abogado deberá cambiarla.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {mutation.isPending ? 'Guardando...' : 'Agregar al equipo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MODAL EDITAR ABOGADO ─────────────────────────────────────────────────────

function EditarAbogadoModal({ abogado, puedeGestionar, onClose, onSuccess }) {
  const [form, setForm] = useState({
    nombre: abogado.nombre || '',
    especialidad: abogado.especialidad || '',
    telefono: abogado.telefono || '',
    rol: abogado.rol || 'ASOCIADO',
  });

  const mutation = useMutation({
    mutationFn: (data) => actualizarAbogado(abogado.id, data),
    onSuccess: () => { toast.success('Perfil actualizado'); onSuccess(); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { nombre: form.nombre, especialidad: form.especialidad, telefono: form.telefono };
    if (puedeGestionar) payload.rol = form.rol;
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Editar perfil</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre completo</label>
            <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Especialidad</label>
            <input value={form.especialidad} onChange={(e) => set('especialidad', e.target.value)}
              placeholder="Ej: Derecho Civil, Laboral..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
            <input value={form.telefono} onChange={(e) => set('telefono', e.target.value)}
              placeholder="Ej: 6000-0000"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {puedeGestionar && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Rol</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES_PERMITIDOS.map((r) => {
                  const m = ROL_META[r];
                  return (
                    <button key={r} type="button" onClick={() => set('rol', r)}
                      className={`py-2.5 text-xs font-semibold rounded-xl border-2 transition-all ${
                        form.rol === r ? `border-current ${m.bg} ${m.text}` : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {mutation.isPending ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
