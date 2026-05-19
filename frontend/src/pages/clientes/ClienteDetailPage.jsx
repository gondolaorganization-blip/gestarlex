import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCliente } from '../../api/clientes';
import {
  getComunicacionesCliente, crearComunicacion, eliminarComunicacion,
} from '../../api/comunicaciones';
import { useAuth } from '../../contexts/AuthContext';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  ArrowLeft, User, Building2, Mail, Phone, MapPin,
  FolderOpen, Scale, MessageSquare, FileText,
  MessagesSquare, Plus, X, Trash2, Users,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TIPOS_COM = ['EMAIL', 'LLAMADA', 'REUNION', 'WHATSAPP', 'CARTA'];

const TIPO_COM_META = {
  EMAIL:    { label: 'Email',    icon: Mail,          cls: 'bg-blue-100 text-blue-700' },
  LLAMADA:  { label: 'Llamada',  icon: Phone,         cls: 'bg-green-100 text-green-700' },
  REUNION:  { label: 'Reunión',  icon: Users,         cls: 'bg-indigo-100 text-indigo-700' },
  WHATSAPP: { label: 'WhatsApp', icon: MessageSquare, cls: 'bg-emerald-100 text-emerald-700' },
  CARTA:    { label: 'Carta',    icon: FileText,      cls: 'bg-orange-100 text-orange-700' },
};

const todayStr = () => new Date().toISOString().split('T')[0];
const FORM_INIT_COM = { tipo: 'EMAIL', descripcion: '', fecha: todayStr(), notas: '', casoId: '' };

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800 font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function ClienteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const puedeEliminarCom = ['ADMIN', 'SOCIO'].includes(user?.rol);

  const [showComForm, setShowComForm]       = useState(false);
  const [comForm, setComForm]               = useState(FORM_INIT_COM);
  const [confirmDelCom, setConfirmDelCom]   = useState(null);

  const { data: cliente, isLoading, error } = useQuery({
    queryKey: ['cliente', id],
    queryFn: () => getCliente(id),
  });

  const { data: comunicaciones = [] } = useQuery({
    queryKey: ['comunicaciones-cliente', id],
    queryFn: () => getComunicacionesCliente(id),
    enabled: !!id,
  });

  const crearCom = useMutation({
    mutationFn: () => crearComunicacion({
      clienteId: id,
      casoId: comForm.casoId || undefined,
      tipo: comForm.tipo,
      descripcion: comForm.descripcion.trim(),
      fecha: comForm.fecha,
      notas: comForm.notas.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Comunicación registrada');
      qc.invalidateQueries({ queryKey: ['comunicaciones-cliente', id] });
      setComForm(FORM_INIT_COM);
      setShowComForm(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al registrar'),
  });

  const eliminarCom = useMutation({
    mutationFn: eliminarComunicacion,
    onSuccess: () => {
      toast.success('Comunicación eliminada');
      setConfirmDelCom(null);
      qc.invalidateQueries({ queryKey: ['comunicaciones-cliente', id] });
    },
    onError: () => toast.error('Error al eliminar'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>;
  if (error || !cliente) return (
    <div className="p-8 text-center">
      <p className="text-red-600 mb-4">No se pudo cargar el cliente.</p>
      <button onClick={() => navigate('/clientes')} className="text-indigo-600 hover:underline">Volver</button>
    </div>
  );

  const casosActivos   = cliente.casos?.filter(c => c.estado === 'ACTIVO') ?? [];
  const casosCerrados  = cliente.casos?.filter(c => c.estado !== 'ACTIVO') ?? [];
  const poderesActivos = cliente.poderes?.filter(p => p.activo) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <button onClick={() => navigate('/clientes')} className="flex items-center gap-1 hover:text-gray-700">
              <ArrowLeft className="w-3.5 h-3.5" /> Clientes
            </button>
            <span>/</span>
            <span className="text-gray-700 font-medium">{cliente.nombre}</span>
          </div>

          <div className="flex items-start gap-4">
            <div className={`flex items-center justify-center w-14 h-14 rounded-2xl shrink-0 ${
              cliente.tipo === 'JURIDICA' ? 'bg-indigo-100' : 'bg-green-100'
            }`}>
              {cliente.tipo === 'JURIDICA'
                ? <Building2 className="w-7 h-7 text-indigo-600" />
                : <User className="w-7 h-7 text-green-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{cliente.nombre}</h1>
                <Badge value={cliente.tipo} />
                {!cliente.activo && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Inactivo</span>
                )}
              </div>
              <div className="flex items-center gap-6 mt-2 flex-wrap">
                {cliente.cedula && <span className="text-sm text-gray-500">Cédula: <span className="font-medium text-gray-700">{cliente.cedula}</span></span>}
                {cliente.ruc    && <span className="text-sm text-gray-500">RUC: <span className="font-medium text-gray-700">{cliente.ruc}</span></span>}
                {cliente.origen && <span className="text-sm text-gray-500">Origen: <span className="font-medium text-gray-700">{cliente.origen}</span></span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna izquierda: info de contacto */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Información de contacto</h2>
            <div className="space-y-3">
              <InfoRow icon={Mail}    label="Correo"   value={cliente.email} />
              <InfoRow icon={Phone}   label="Teléfono" value={cliente.telefono} />
              <InfoRow icon={MapPin}  label="Origen"   value={cliente.origen} />
            </div>
            {cliente.notas && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Notas</p>
                <p className="text-sm text-gray-600">{cliente.notas}</p>
              </div>
            )}
          </div>

          {/* Poderes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Scale className="w-4 h-4 text-indigo-500" />
                Poderes ({cliente.poderes?.length ?? 0})
              </h2>
            </div>
            {poderesActivos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-3">Sin poderes activos</p>
            ) : (
              <div className="space-y-3">
                {poderesActivos.map((p) => (
                  <div key={p.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <Badge value={p.tipo} />
                      {p.fechaVence && (
                        <span className="text-xs text-gray-400">
                          Vence {format(parseISO(p.fechaVence), "d MMM yyyy", { locale: es })}
                        </span>
                      )}
                    </div>
                    {p.notaria && <p className="text-xs text-gray-500 mt-1">{p.notaria}</p>}
                    {p.tomo && <p className="text-xs text-gray-400">Tomo {p.tomo}, Folio {p.folio}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: casos */}
        <div className="lg:col-span-2 space-y-4">
          {/* Casos activos */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-green-500" />
                Casos activos ({casosActivos.length})
              </h2>
              <Link
                to={`/casos/nuevo?clienteId=${id}`}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                + Nuevo caso
              </Link>
            </div>
            {casosActivos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Sin casos activos</p>
            ) : (
              <div className="space-y-2">
                {casosActivos.map((c) => (
                  <Link key={c.id} to={`/casos/${c.id}`} className="block">
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-gray-100 hover:border-indigo-200 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {c.numero}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-800 truncate max-w-xs">{c.titulo}</p>
                          {c.juzgado && <p className="text-xs text-gray-400 truncate">{c.juzgado}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge value={c.tipo} />
                        <span className="text-indigo-400 text-xs">→</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Casos cerrados/archivados */}
          {casosCerrados.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-500 flex items-center gap-2 mb-4">
                <FolderOpen className="w-4 h-4" />
                Casos cerrados / archivados ({casosCerrados.length})
              </h2>
              <div className="space-y-2">
                {casosCerrados.map((c) => (
                  <Link key={c.id} to={`/casos/${c.id}`} className="block">
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 opacity-70">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{c.numero}</span>
                        <p className="text-sm text-gray-600 truncate max-w-xs">{c.titulo}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge value={c.estado} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Comunicaciones ─────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <MessagesSquare className="w-4 h-4 text-indigo-500" />
              Comunicaciones ({comunicaciones.length})
            </h2>
            <button
              onClick={() => { setShowComForm((v) => !v); setComForm(FORM_INIT_COM); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {showComForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showComForm ? 'Cancelar' : 'Registrar'}
            </button>
          </div>

          {/* Form */}
          {showComForm && (
            <div className="mb-5 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <div className="flex flex-wrap gap-2 mb-3">
                {TIPOS_COM.map((t) => {
                  const { label, icon: Icon, cls } = TIPO_COM_META[t];
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setComForm((f) => ({ ...f, tipo: t }))}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                        comForm.tipo === t ? `border-transparent ${cls}` : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />{label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <textarea
                    value={comForm.descripcion}
                    onChange={(e) => setComForm((f) => ({ ...f, descripcion: e.target.value }))}
                    rows={2}
                    placeholder="Descripción de la comunicación... *"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={comForm.fecha}
                    onChange={(e) => setComForm((f) => ({ ...f, fecha: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                  {cliente?.casos?.filter(c => c.estado === 'ACTIVO').length > 0 && (
                    <select
                      value={comForm.casoId}
                      onChange={(e) => setComForm((f) => ({ ...f, casoId: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">Sin caso específico</option>
                      {cliente.casos.filter(c => c.estado === 'ACTIVO').map((c) => (
                        <option key={c.id} value={c.id}>{c.numero} — {c.titulo}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="sm:col-span-3">
                  <input
                    value={comForm.notas}
                    onChange={(e) => setComForm((f) => ({ ...f, notas: e.target.value }))}
                    placeholder="Notas adicionales (opcional)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => { setShowComForm(false); setComForm(FORM_INIT_COM); }}
                  className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => crearCom.mutate()}
                  disabled={comForm.descripcion.trim().length < 3 || crearCom.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {crearCom.isPending ? <Spinner size="sm" /> : <Plus className="w-3.5 h-3.5" />}
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {comunicaciones.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <MessagesSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sin comunicaciones registradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {comunicaciones.map((c) => {
                const meta = TIPO_COM_META[c.tipo] ?? TIPO_COM_META.EMAIL;
                const Icon = meta.icon;
                return (
                  <div key={c.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${meta.cls}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                        {c.caso && (
                          <Link to={`/casos/${c.caso.id}`} className="text-xs text-indigo-600 hover:underline font-mono">
                            {c.caso.numero}
                          </Link>
                        )}
                        {c.abogado && <span className="text-xs text-gray-400">{c.abogado.nombre}</span>}
                      </div>
                      <p className="text-sm text-gray-800">{c.descripcion}</p>
                      {c.notas && <p className="text-xs text-gray-400 mt-0.5 italic">"{c.notas}"</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {format(parseISO(c.fecha), "d MMM yyyy", { locale: es })}
                      </span>
                      {puedeEliminarCom && (
                        confirmDelCom === c.id ? (
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              onClick={() => eliminarCom.mutate(c.id)}
                              disabled={eliminarCom.isPending}
                              className="text-xs px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                            >Sí</button>
                            <button
                              onClick={() => setConfirmDelCom(null)}
                              className="text-xs px-1.5 py-0.5 text-gray-500 border border-gray-200 rounded hover:bg-gray-50"
                            >No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelCom(c.id)}
                            className="ml-1 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
