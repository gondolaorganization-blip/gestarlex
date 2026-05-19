import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearCaso } from '../../api/casos';
import { getClientes } from '../../api/clientes';
import { getAbogados } from '../../api/abogados';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

const TIPOS_CASO = ['CIVIL', 'PENAL', 'LABORAL', 'COMERCIAL', 'ADMINISTRATIVO', 'FAMILIAR', 'MARITIMO', 'OTRO'];
const TIPOS_CASO_LABELS = {
  CIVIL: 'Civil', PENAL: 'Penal', LABORAL: 'Laboral', COMERCIAL: 'Comercial',
  ADMINISTRATIVO: 'Administrativo', FAMILIAR: 'Familiar', MARITIMO: 'Marítimo', OTRO: 'Otro',
};
const TIPOS_HONORARIO = ['HORA', 'FIJO', 'CONTINGENCIA', 'MIXTO'];
const TIPOS_HON_LABELS = {
  HORA: 'Por hora', FIJO: 'Monto fijo', CONTINGENCIA: 'Contingencia (%)', MIXTO: 'Mixto',
};

export default function NuevoCasoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const clienteIdParam = searchParams.get('clienteId') || '';

  const [form, setForm] = useState({
    clienteId: clienteIdParam,
    abogadoId: '',
    numero: '',
    titulo: '',
    tipo: '',
    juzgado: '',
    juez: '',
    contraparte: '',
    descripcion: '',
    fechaApertura: '',
    honorarioTipo: '',
    tarifaHora: '',
    montoFijo: '',
    porcentajeExito: '',
    honorarioDesc: '',
  });

  const [showHonorarios, setShowHonorarios] = useState(false);

  const { data: clientesResp } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: () => getClientes({ porPagina: 200 }),
    enabled: !clienteIdParam,
  });
  const clientes = clientesResp?.datos ?? [];

  const { data: abogados = [] } = useQuery({
    queryKey: ['abogados'],
    queryFn: getAbogados,
  });

  const mutation = useMutation({
    mutationFn: crearCaso,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['casos'] });
      toast.success('Expediente creado exitosamente');
      navigate(`/casos/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al crear el caso');
    },
  });

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      clienteId: form.clienteId,
      abogadoId: form.abogadoId,
      numero: form.numero,
      titulo: form.titulo,
    };
    if (form.tipo) payload.tipo = form.tipo;
    if (form.juzgado) payload.juzgado = form.juzgado;
    if (form.juez) payload.juez = form.juez;
    if (form.contraparte) payload.contraparte = form.contraparte;
    if (form.descripcion) payload.descripcion = form.descripcion;
    if (form.fechaApertura) payload.fechaApertura = form.fechaApertura;
    if (showHonorarios && form.honorarioTipo) {
      payload.honorario = { tipo: form.honorarioTipo };
      if (form.tarifaHora) payload.honorario.tarifaHora = parseFloat(form.tarifaHora);
      if (form.montoFijo) payload.honorario.montoFijo = parseFloat(form.montoFijo);
      if (form.porcentajeExito) payload.honorario.porcentajeExito = parseFloat(form.porcentajeExito);
      if (form.honorarioDesc) payload.honorario.descripcion = form.honorarioDesc;
    }
    mutation.mutate(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 hover:text-gray-700">
              <ArrowLeft className="w-3.5 h-3.5" /> Volver
            </button>
            <span>/</span>
            <span className="text-gray-700 font-medium">Nuevo caso</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-2">Abrir expediente</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Expediente */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Expediente</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Número de expediente <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.numero}
                  onChange={(e) => set('numero', e.target.value)}
                  placeholder="Ej: 2024-CV-0001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de apertura</label>
                <input
                  type="date"
                  value={form.fechaApertura}
                  onChange={(e) => set('fechaApertura', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Título del caso <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.titulo}
                  onChange={(e) => set('titulo', e.target.value)}
                  placeholder="Ej: Díaz vs. Constructora Omega — Daños y Perjuicios"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Partes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Partes</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Cliente <span className="text-red-500">*</span>
                </label>
                {clienteIdParam ? (
                  <ClientePreseleccionado
                    clienteId={clienteIdParam}
                    onCambiar={() => navigate('/casos/nuevo')}
                  />
                ) : (
                  <select
                    required
                    value={form.clienteId}
                    onChange={(e) => set('clienteId', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Abogado responsable <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={form.abogadoId}
                  onChange={(e) => set('abogadoId', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccionar abogado...</option>
                  {abogados.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contraparte</label>
                <input
                  value={form.contraparte}
                  onChange={(e) => set('contraparte', e.target.value)}
                  placeholder="Nombre de la parte contraria"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Materia y juzgado */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Materia y juzgado</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de proceso</label>
                <select
                  value={form.tipo}
                  onChange={(e) => set('tipo', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccionar...</option>
                  {TIPOS_CASO.map((t) => (
                    <option key={t} value={t}>{TIPOS_CASO_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Juzgado / Tribunal</label>
                <input
                  value={form.juzgado}
                  onChange={(e) => set('juzgado', e.target.value)}
                  placeholder="Ej: Juzgado 5° Civil del Circuito"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Juez</label>
                <input
                  value={form.juez}
                  onChange={(e) => set('juez', e.target.value)}
                  placeholder="Nombre del juez"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Descripción / Pretensión</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => set('descripcion', e.target.value)}
                rows={3}
                placeholder="Resumen del caso, pretensiones, antecedentes relevantes..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Honorarios (colapsable) */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHonorarios((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-700">Honorarios <span className="font-normal text-gray-400">(opcional)</span></span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showHonorarios ? 'rotate-180' : ''}`} />
            </button>
            {showHonorarios && (
              <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">Tipo de honorario</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {TIPOS_HONORARIO.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => set('honorarioTipo', form.honorarioTipo === t ? '' : t)}
                          className={`p-2 text-xs font-medium rounded-lg border transition-all ${
                            form.honorarioTipo === t
                              ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                              : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {TIPOS_HON_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                  {form.honorarioTipo && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {(form.honorarioTipo === 'HORA' || form.honorarioTipo === 'MIXTO') && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tarifa por hora (B/.)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={form.tarifaHora}
                            onChange={(e) => set('tarifaHora', e.target.value)}
                            placeholder="0.00"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                      {(form.honorarioTipo === 'FIJO' || form.honorarioTipo === 'MIXTO') && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Monto fijo (B/.)</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={form.montoFijo}
                            onChange={(e) => set('montoFijo', e.target.value)}
                            placeholder="0.00"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                      {(form.honorarioTipo === 'CONTINGENCIA' || form.honorarioTipo === 'MIXTO') && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">% de éxito</label>
                          <input
                            type="number" min="0" max="100" step="0.1"
                            value={form.porcentajeExito}
                            onChange={(e) => set('porcentajeExito', e.target.value)}
                            placeholder="0"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Descripción del acuerdo</label>
                        <input
                          value={form.honorarioDesc}
                          onChange={(e) => set('honorarioDesc', e.target.value)}
                          placeholder="Ej: Cobro mensual de B/. 500 más 15% del monto recuperado"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Creando...' : 'Abrir expediente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ClientePreseleccionado({ clienteId, onCambiar }) {
  const { data: clientesResp } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: () => getClientes({ porPagina: 200 }),
  });
  const nombre = clientesResp?.datos?.find((c) => c.id === clienteId)?.nombre;
  return (
    <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
      <span className="text-sm font-medium text-indigo-800">{nombre ?? clienteId}</span>
      <button type="button" onClick={onCambiar} className="ml-auto text-xs text-indigo-500 hover:text-indigo-700">
        Cambiar
      </button>
    </div>
  );
}
