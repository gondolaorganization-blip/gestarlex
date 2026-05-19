import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirmas, updateSuscripcion, getEventos } from '../../api/admin';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ESTADO_BADGE = {
  TRIAL:      'bg-yellow-900 text-yellow-300 border-yellow-700',
  ACTIVO:     'bg-green-900 text-green-300 border-green-700',
  SUSPENDIDO: 'bg-red-900 text-red-300 border-red-700',
  VENCIDO:    'bg-gray-800 text-gray-400 border-gray-600',
};

const PLAN_LABEL = { SOLO: 'Solo', FIRMA: 'Firma', ENTERPRISE: 'Enterprise' };

function EstadoBadge({ estado, manual }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${ESTADO_BADGE[estado] ?? ''}`}>
      {estado}
      {manual && <span className="text-xs opacity-70" title="Acceso manual">M</span>}
    </span>
  );
}

function FirmaModal({ firma, onClose, onSaved }) {
  const [form, setForm] = useState({
    suscripcionEstado: firma.suscripcionEstado,
    plan: firma.plan,
    accessManual: firma.accessManual,
    trialEndsAt: firma.trialEndsAt ? firma.trialEndsAt.slice(0, 10) : '',
    suscripcionVenceEn: firma.suscripcionVenceEn ? firma.suscripcionVenceEn.slice(0, 10) : '',
  });
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getEventos(firma.id).then(setEventos).catch(() => {});
  }, [firma.id]);

  const handleSave = async () => {
    setError('');
    setLoading(true);
    try {
      const payload = {
        suscripcionEstado: form.suscripcionEstado,
        plan: form.plan,
        accessManual: form.accessManual,
        trialEndsAt: form.trialEndsAt ? new Date(form.trialEndsAt).toISOString() : null,
        suscripcionVenceEn: form.suscripcionVenceEn ? new Date(form.suscripcionVenceEn).toISOString() : null,
      };
      await updateSuscripcion(firma.id, payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al guardar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-800 flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold text-white">{firma.nombre}</h2>
            <p className="text-sm text-gray-400">{firma.email} · {firma.ruc}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Estado */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Estado suscripción</label>
              <select
                value={form.suscripcionEstado}
                onChange={(e) => setForm({ ...form, suscripcionEstado: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {['TRIAL', 'ACTIVO', 'SUSPENDIDO', 'VENCIDO'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Plan</label>
              <select
                value={form.plan}
                onChange={(e) => setForm({ ...form, plan: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {['SOLO', 'FIRMA', 'ENTERPRISE'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Trial vence</label>
              <input
                type="date"
                value={form.trialEndsAt}
                onChange={(e) => setForm({ ...form, trialEndsAt: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Suscripción vence</label>
              <input
                type="date"
                value={form.suscripcionVenceEn}
                onChange={(e) => setForm({ ...form, suscripcionVenceEn: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Acceso manual */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setForm({ ...form, accessManual: !form.accessManual })}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.accessManual ? 'bg-indigo-600' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${form.accessManual ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm text-gray-300">Acceso manual activo (ignora estado de suscripción)</span>
          </label>

          {error && (
            <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-4 py-2">{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>

        {/* Log de eventos */}
        {eventos.length > 0 && (
          <div className="px-6 pb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Historial</p>
            <div className="space-y-2">
              {eventos.map((ev) => (
                <div key={ev.id} className="flex items-start justify-between text-xs text-gray-400 bg-gray-800/50 rounded-lg px-3 py-2">
                  <span className="font-medium text-gray-300">{ev.evento}</span>
                  <span className="text-gray-500 ml-4 shrink-0">
                    {format(new Date(ev.createdAt), 'dd MMM yyyy HH:mm', { locale: es })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminFirmasPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({ firmas: [], total: 0, page: 1, pages: 1 });
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [firmaSeleccionada, setFirmaSeleccionada] = useState(null);

  const cargar = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const resultado = await getFirmas({
        page,
        busqueda: busqueda || undefined,
        estado: estadoFiltro || undefined,
      });
      setData(resultado);
    } catch (err) {
      if (err.response?.status === 401) navigate('/admin/login');
    } finally {
      setLoading(false);
    }
  }, [busqueda, estadoFiltro, navigate]);

  useEffect(() => {
    const t = setTimeout(() => cargar(1), 300);
    return () => clearTimeout(t);
  }, [cargar]);

  const logout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">Super Admin</span>
          <h1 className="text-lg font-bold">GESTARLEX</h1>
        </div>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-white transition-colors">
          Cerrar sesión
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Título + estadísticas */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-1">Firmas registradas</h2>
          <p className="text-sm text-gray-400">{data.total} firma{data.total !== 1 ? 's' : ''} en total</p>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 mb-6">
          <input
            type="search"
            placeholder="Buscar por nombre, email o RUC..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="flex-1 bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos los estados</option>
            {['TRIAL', 'ACTIVO', 'SUSPENDIDO', 'VENCIDO'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Tabla */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500 text-sm">Cargando...</div>
          ) : data.firmas.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">No se encontraron firmas.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-800">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Firma</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Trial / Vence</th>
                  <th className="px-4 py-3">Abogados</th>
                  <th className="px-4 py-3">Casos</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.firmas.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-white">{f.nombre}</p>
                      <p className="text-xs text-gray-500">{f.email}</p>
                    </td>
                    <td className="px-4 py-4 text-gray-300">{PLAN_LABEL[f.plan]}</td>
                    <td className="px-4 py-4">
                      <EstadoBadge estado={f.suscripcionEstado} manual={f.accessManual} />
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-400">
                      {f.trialEndsAt
                        ? <span>Trial: {format(new Date(f.trialEndsAt), 'dd MMM yyyy', { locale: es })}</span>
                        : f.suscripcionVenceEn
                        ? <span>Vence: {format(new Date(f.suscripcionVenceEn), 'dd MMM yyyy', { locale: es })}</span>
                        : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-4 text-gray-300">{f._count.abogados}</td>
                    <td className="px-4 py-4 text-gray-300">{f._count.casos}</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => setFirmaSeleccionada(f)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                      >
                        Gestionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        {data.pages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => cargar(p)}
                className={`w-8 h-8 text-sm rounded-lg ${data.page === p ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </main>

      {firmaSeleccionada && (
        <FirmaModal
          firma={firmaSeleccionada}
          onClose={() => setFirmaSeleccionada(null)}
          onSaved={() => cargar(data.page)}
        />
      )}
    </div>
  );
}
