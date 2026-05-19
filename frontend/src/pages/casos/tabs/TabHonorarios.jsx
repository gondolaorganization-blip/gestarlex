import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getHonorarioConfig, upsertHonorarioConfig,
  getHorasCaso, registrarHoras, eliminarHoras,
} from '../../../api/honorarios';
import { generarFacturaDesdeCaso } from '../../../api/facturas';
import { useAuth } from '../../../contexts/AuthContext';
import Spinner from '../../../components/ui/Spinner';
import toast from 'react-hot-toast';
import {
  DollarSign, Clock, Plus, Trash2, X, Edit2,
  Check, AlertCircle, Lock, Receipt,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TIPO_META = {
  HORA:         { label: 'Por Hora',               desc: 'Tarifa B/./hora · ref. Acuerdo 49/2001' },
  FIJO:         { label: 'Monto Fijo',             desc: 'Honorario pactado por el caso completo' },
  CONTINGENCIA: { label: 'Contingencia',           desc: 'Porcentaje del monto obtenido al éxito' },
  MIXTO:        { label: 'Mixto',                  desc: 'Combinación de tarifa hora + monto fijo' },
};

const fmtMonto = (n) =>
  `B/. ${Number(n || 0).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayStr = () => new Date().toISOString().split('T')[0];

const CONFIG_INIT = { tipo: 'HORA', tarifaHora: '', montoFijo: '', porcentajeExito: '', descripcion: '' };
const HORA_INIT   = { fecha: todayStr(), horas: '', descripcion: '', facturable: true };

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function ConfigDisplay({ config, onEdit, puedeEditar }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-bold text-gray-900">{TIPO_META[config.tipo]?.label}</span>
          <span className="text-xs text-gray-400">· {TIPO_META[config.tipo]?.desc}</span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {config.tarifaHora != null && (
            <span className="text-gray-700">
              Tarifa hora: <span className="font-bold text-indigo-700">{fmtMonto(config.tarifaHora)}/h</span>
            </span>
          )}
          {config.montoFijo != null && (
            <span className="text-gray-700">
              Monto fijo: <span className="font-bold text-green-700">{fmtMonto(config.montoFijo)}</span>
            </span>
          )}
          {config.porcentajeExito != null && (
            <span className="text-gray-700">
              Éxito: <span className="font-bold text-orange-700">{Number(config.porcentajeExito).toFixed(1)}%</span>
            </span>
          )}
        </div>
        {config.descripcion && (
          <p className="text-xs text-gray-400 mt-1">{config.descripcion}</p>
        )}
      </div>
      {puedeEditar && (
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
        >
          <Edit2 className="w-3.5 h-3.5" /> Editar
        </button>
      )}
    </div>
  );
}

function ConfigForm({ initial, onSave, onCancel, isPending }) {
  const [form, setForm] = useState(initial ?? CONFIG_INIT);
  const set = (f) => (e) => setForm((v) => ({ ...v, [f]: e.target.value }));

  const showTarifa  = ['HORA', 'MIXTO'].includes(form.tipo);
  const showFijo    = ['FIJO', 'MIXTO'].includes(form.tipo);
  const showContingencia = ['CONTINGENCIA'].includes(form.tipo);

  const canSave = form.tipo &&
    !(showTarifa && !form.tarifaHora) &&
    !(showFijo && !form.montoFijo) &&
    !(showContingencia && !form.porcentajeExito);

  return (
    <div className="space-y-4">
      {/* Tipo */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Tipo de honorario</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(TIPO_META).map(([k, { label, desc }]) => (
            <button
              key={k}
              type="button"
              onClick={() => setForm((v) => ({ ...v, tipo: k }))}
              className={`p-3 rounded-xl border text-left transition-all ${
                form.tipo === k
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`text-xs font-bold ${form.tipo === k ? 'text-indigo-700' : 'text-gray-700'}`}>{label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {showTarifa && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tarifa/hora (B/.) <span className="text-red-500">*</span>
            </label>
            <input
              type="number" step="0.01" min="0"
              value={form.tarifaHora}
              onChange={set('tarifaHora')}
              placeholder="Ej: 150.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
        {showFijo && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Monto fijo (B/.) <span className="text-red-500">*</span>
            </label>
            <input
              type="number" step="0.01" min="0"
              value={form.montoFijo}
              onChange={set('montoFijo')}
              placeholder="Ej: 2500.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
        {showContingencia && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              % de éxito <span className="text-red-500">*</span>
            </label>
            <input
              type="number" step="0.1" min="0" max="100"
              value={form.porcentajeExito}
              onChange={set('porcentajeExito')}
              placeholder="Ej: 20.0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}
        <div className={showTarifa || showFijo || showContingencia ? '' : 'sm:col-span-3'}>
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción (opcional)</label>
          <input
            value={form.descripcion}
            onChange={set('descripcion')}
            placeholder="Ej: Tarifa pactada con el cliente"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={!canSave || isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? <Spinner size="sm" /> : <Check className="w-4 h-4" />}
          Guardar
        </button>
      </div>
    </div>
  );
}

// ─── MODAL FACTURAR HORAS ─────────────────────────────────────────────────────

function ModalFacturarHoras({ casoId, config, totales, onClose }) {
  const qc = useQueryClient();
  const [diasVence, setDiasVence] = useState('30');
  const [notas, setNotas] = useState('');

  const horasPendientes = Number(totales.pendienteFacturar);
  const tarifa = Number(config?.tarifaHora || 0);
  const montoHoras = horasPendientes * tarifa;
  const montoFijo = Number(config?.montoFijo || 0);
  const montoTotal = config?.tipo === 'MIXTO' ? montoHoras + montoFijo : montoHoras;

  const mutation = useMutation({
    mutationFn: () => generarFacturaDesdeCaso(casoId, {
      diasVence: parseInt(diasVence) || 30,
      notas: notas || undefined,
    }),
    onSuccess: (factura) => {
      toast.success(`Factura ${factura.numero} creada`);
      qc.invalidateQueries({ queryKey: ['honorario-horas', casoId] });
      qc.invalidateQueries({ queryKey: ['facturas'] });
      qc.invalidateQueries({ queryKey: ['caso-stats', casoId] });
      onClose();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al generar factura'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <h2 className="text-base font-bold text-gray-900">Facturar horas pendientes</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Resumen de cálculo */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Horas pendientes</span>
              <span className="font-bold text-gray-900">{horasPendientes.toFixed(2)} h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tarifa</span>
              <span className="font-bold text-gray-900">{fmtMonto(tarifa)}/h</span>
            </div>
            {config?.tipo === 'MIXTO' && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Monto fijo</span>
                <span className="font-bold text-gray-900">{fmtMonto(montoFijo)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-1.5 border-t border-indigo-200">
              <span className="font-semibold text-indigo-800">Total a facturar</span>
              <span className="text-lg font-bold text-indigo-700">{fmtMonto(montoTotal)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Días hasta vencimiento</label>
            <input
              type="number" min="1" max="365"
              value={diasVence}
              onChange={(e) => setDiasVence(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas adicionales (opcional)</label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Se agregará al desglose automático de la factura..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <p className="text-xs text-gray-400">
            Las horas marcadas como facturables quedarán registradas en esta factura y no se incluirán en futuras facturaciones.
          </p>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || horasPendientes === 0}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Spinner size="sm" /> : <Receipt className="w-4 h-4" />}
              Generar factura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN TAB ─────────────────────────────────────────────────────────────────

export default function TabHonorarios({ casoId }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const puedeConfig  = ['ADMIN', 'SOCIO', 'ASOCIADO'].includes(user?.rol);
  const puedeElim    = (r) => !r.facturaId && !(user?.rol === 'PASANTE' && r.abogadoId !== user?.sub);

  const [editConfig, setEditConfig]     = useState(false);
  const [showHoraForm, setShowHoraForm] = useState(false);
  const [horaForm, setHoraForm]         = useState(HORA_INIT);
  const [confirmDel, setConfirmDel]     = useState(null);
  const [showFacturar, setShowFacturar] = useState(false);

  // ── queries ──────────────────────────────────────────────────────────────

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['honorario-config', casoId],
    queryFn: () => getHonorarioConfig(casoId),
    retry: false,
  });

  const { data: horasData, isLoading: loadingHoras } = useQuery({
    queryKey: ['honorario-horas', casoId],
    queryFn: () => getHorasCaso(casoId),
  });

  const registros = horasData?.registros ?? [];
  const totales   = horasData?.totales   ?? { total: 0, pendienteFacturar: 0, facturadas: 0 };

  // ── mutations ─────────────────────────────────────────────────────────────

  const saveConfig = useMutation({
    mutationFn: (data) => upsertHonorarioConfig(casoId, {
      tipo: data.tipo,
      tarifaHora:      data.tarifaHora      ? parseFloat(data.tarifaHora)      : null,
      montoFijo:       data.montoFijo       ? parseFloat(data.montoFijo)       : null,
      porcentajeExito: data.porcentajeExito ? parseFloat(data.porcentajeExito) : null,
      descripcion:     data.descripcion || null,
    }),
    onSuccess: () => {
      toast.success('Configuración guardada');
      qc.invalidateQueries({ queryKey: ['honorario-config', casoId] });
      qc.invalidateQueries({ queryKey: ['caso-stats', casoId] });
      setEditConfig(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al guardar'),
  });

  const addHora = useMutation({
    mutationFn: () => registrarHoras(casoId, {
      fecha:       horaForm.fecha,
      horas:       parseFloat(horaForm.horas),
      descripcion: horaForm.descripcion.trim(),
      facturable:  horaForm.facturable,
    }),
    onSuccess: () => {
      toast.success('Horas registradas');
      qc.invalidateQueries({ queryKey: ['honorario-horas', casoId] });
      qc.invalidateQueries({ queryKey: ['caso-stats', casoId] });
      setHoraForm(HORA_INIT);
      setShowHoraForm(false);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al registrar'),
  });

  const delHora = useMutation({
    mutationFn: eliminarHoras,
    onSuccess: () => {
      toast.success('Registro eliminado');
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ['honorario-horas', casoId] });
      qc.invalidateQueries({ queryKey: ['caso-stats', casoId] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'No se puede eliminar'),
  });

  const canAddHora = parseFloat(horaForm.horas) > 0 && horaForm.descripcion.trim().length >= 3 && !addHora.isPending;

  // ── config initial values for edit form ──────────────────────────────────

  const configForForm = config ? {
    tipo:            config.tipo,
    tarifaHora:      config.tarifaHora      != null ? String(config.tarifaHora)      : '',
    montoFijo:       config.montoFijo       != null ? String(config.montoFijo)       : '',
    porcentajeExito: config.porcentajeExito != null ? String(config.porcentajeExito) : '',
    descripcion:     config.descripcion ?? '',
  } : null;

  return (
    <>
    <div className="space-y-6 max-w-4xl">

      {/* ── CONFIGURACIÓN ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-gray-800">Configuración de honorarios</h3>
        </div>

        {loadingConfig ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : editConfig ? (
          <ConfigForm
            initial={configForForm}
            onSave={(data) => saveConfig.mutate(data)}
            onCancel={() => setEditConfig(false)}
            isPending={saveConfig.isPending}
          />
        ) : config ? (
          <ConfigDisplay config={config} onEdit={() => setEditConfig(true)} puedeEditar={puedeConfig} />
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              Sin configurar — el cálculo de valor facturable usa tarifa B/. 0.00
            </div>
            {puedeConfig && (
              <button
                onClick={() => setEditConfig(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Configurar
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── REGISTRO DE HORAS ────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* Header + totales */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-xl font-bold text-gray-900">{Number(totales.total).toFixed(1)} h</p>
              <p className="text-xs text-gray-500 mt-0.5">Total registradas</p>
            </div>
            <div className="bg-indigo-50 rounded-xl border border-indigo-200 px-4 py-3">
              <p className="text-xl font-bold text-indigo-700">{Number(totales.pendienteFacturar).toFixed(1)} h</p>
              <p className="text-xs text-indigo-500 mt-0.5">Pendiente facturar</p>
            </div>
            {totales.facturadas > 0 && (
              <div className="bg-green-50 rounded-xl border border-green-200 px-4 py-3">
                <p className="text-xl font-bold text-green-700">{Number(totales.facturadas).toFixed(1)} h</p>
                <p className="text-xs text-green-500 mt-0.5">Ya facturadas</p>
              </div>
            )}
            {config?.tarifaHora && totales.pendienteFacturar > 0 && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                <p className="text-xl font-bold text-gray-800">
                  {fmtMonto(Number(totales.pendienteFacturar) * Number(config.tarifaHora))}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Valor pendiente</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {puedeConfig && config && ['HORA', 'MIXTO'].includes(config.tipo) && totales.pendienteFacturar > 0 && (
              <button
                onClick={() => setShowFacturar(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Receipt className="w-4 h-4" />
                Facturar {Number(totales.pendienteFacturar).toFixed(1)}h
              </button>
            )}
            <button
              onClick={() => { setShowHoraForm((v) => !v); setHoraForm(HORA_INIT); }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {showHoraForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showHoraForm ? 'Cancelar' : 'Registrar horas'}
            </button>
          </div>
        </div>

        {/* Add form */}
        {showHoraForm && (
          <div className="bg-white rounded-xl border-2 border-indigo-200 p-5">
            <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" /> Registro manual de horas
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Descripción <span className="text-red-500">*</span>
                </label>
                <input
                  value={horaForm.descripcion}
                  onChange={(e) => setHoraForm((f) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Revisión de expediente y preparación de demanda"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Horas <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" step="0.25" min="0.25"
                  value={horaForm.horas}
                  onChange={(e) => setHoraForm((f) => ({ ...f, horas: e.target.value }))}
                  placeholder="Ej: 2.5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                <input
                  type="date"
                  value={horaForm.fecha}
                  onChange={(e) => setHoraForm((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-end pb-0.5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setHoraForm((f) => ({ ...f, facturable: !f.facturable }))}
                    className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${horaForm.facturable ? 'bg-indigo-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${horaForm.facturable ? 'translate-x-5' : ''}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Facturable</p>
                    <p className="text-xs text-gray-400">Se incluye en el valor del caso</p>
                  </div>
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setShowHoraForm(false); setHoraForm(HORA_INIT); }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => addHora.mutate()}
                disabled={!canAddHora}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {addHora.isPending ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
                Registrar
              </button>
            </div>
          </div>
        )}

        {/* Hour log */}
        {loadingHoras ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : registros.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin registros de horas</p>
            <p className="text-sm mt-1">Los timers activos también generan registros aquí al detenerse</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Abogado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Descripción</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Horas</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {registros.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {format(parseISO(r.fecha), "d MMM yyyy", { locale: es })}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">
                      {r.abogado?.nombre ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{r.descripcion}</td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-gray-900">
                      {Number(r.horas).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.facturaId ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          <Lock className="w-3 h-3" /> Facturada
                        </span>
                      ) : r.facturable ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                          Facturable
                        </span>
                      ) : (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          No facturable
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {puedeElim(r) && (
                        confirmDel === r.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => delHora.mutate(r.id)}
                              disabled={delHora.isPending}
                              className="text-xs px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700"
                            >Sí</button>
                            <button
                              onClick={() => setConfirmDel(null)}
                              className="text-xs px-1.5 py-0.5 text-gray-500 border border-gray-200 rounded hover:bg-gray-50"
                            >No</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDel(r.id)}
                            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={3} className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Total</td>
                  <td className="px-4 py-2 text-right font-bold font-mono text-gray-900">
                    {Number(totales.total).toFixed(2)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>

    {showFacturar && (
      <ModalFacturarHoras
        casoId={casoId}
        config={config}
        totales={totales}
        onClose={() => setShowFacturar(false)}
      />
    )}
    </>
  );
}
