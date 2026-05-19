import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getMisTimers, iniciarTimer, pausarTimer, reanudarTimer, detenerTimer, descartarTimer } from '../../api/timer';
import { getCasos } from '../../api/casos';
import { Clock, Play, Pause, Square, Trash2, Plus, X, ChevronDown } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatHoras(seconds) {
  return (Math.round((seconds / 3600) * 100) / 100).toFixed(2);
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function TimerPage() {
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [showNuevo, setShowNuevo] = useState(false);
  const [stopModal, setStopModal] = useState(null);

  // Tick global every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: timers = [], isLoading } = useQuery({
    queryKey: ['mis-timers'],
    queryFn: getMisTimers,
    refetchInterval: 30_000,
  });

  const mutPausar = useMutation({
    mutationFn: pausarTimer,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mis-timers'] }); toast.success('Timer pausado'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  const mutReanudar = useMutation({
    mutationFn: reanudarTimer,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mis-timers'] }); toast.success('Timer reanudado'); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  const mutDescartar = useMutation({
    mutationFn: descartarTimer,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mis-timers'] }); toast('Timer descartado', { icon: '🗑' }); },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  const totalSegundosActivos = timers
    .filter((t) => t.estado === 'CORRIENDO')
    .reduce((acc, t) => {
      return acc + t.duracionAcumulada + Math.floor((now - new Date(t.iniciadoEn).getTime()) / 1000);
    }, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Control de Horas</h1>
                {timers.length > 0 && (
                  <p className="text-xs text-gray-500">
                    {timers.filter((t) => t.estado === 'CORRIENDO').length} corriendo ·{' '}
                    {timers.length} total activos
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {totalSegundosActivos > 0 && (
                <div className="text-right">
                  <p className="text-xs text-gray-400">Tiempo total hoy</p>
                  <p className="text-lg font-bold text-indigo-600 font-mono">{formatTime(totalSegundosActivos)}</p>
                </div>
              )}
              <button
                onClick={() => setShowNuevo((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nuevo timer
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {/* Nuevo timer panel */}
        {showNuevo && (
          <NuevoTimerPanel
            onClose={() => setShowNuevo(false)}
            onSuccess={() => {
              setShowNuevo(false);
              qc.invalidateQueries({ queryKey: ['mis-timers'] });
            }}
          />
        )}

        {/* Timer cards */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : timers.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Sin timers activos</p>
            <p className="text-sm text-gray-400 mt-1">Inicia un timer para registrar tiempo en un caso</p>
            <button
              onClick={() => setShowNuevo(true)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
            >
              + Iniciar timer
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {timers.map((timer) => {
              const liveSeconds =
                timer.estado === 'CORRIENDO'
                  ? timer.duracionAcumulada + Math.floor((now - new Date(timer.iniciadoEn).getTime()) / 1000)
                  : timer.duracionAcumulada;
              const corriendo = timer.estado === 'CORRIENDO';

              return (
                <div
                  key={timer.id}
                  className={`bg-white rounded-xl border-2 transition-all ${
                    corriendo ? 'border-indigo-200 shadow-sm' : 'border-gray-200'
                  }`}
                >
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Clock display */}
                      <div className={`flex-shrink-0 rounded-xl px-4 py-3 text-center min-w-[130px] ${
                        corriendo ? 'bg-indigo-600' : 'bg-gray-100'
                      }`}>
                        <p className={`text-2xl font-bold font-mono tracking-wider ${
                          corriendo ? 'text-white' : 'text-gray-600'
                        }`}>
                          {formatTime(liveSeconds)}
                        </p>
                        <p className={`text-xs mt-0.5 font-medium ${corriendo ? 'text-indigo-200' : 'text-gray-400'}`}>
                          {formatHoras(liveSeconds)} hrs
                        </p>
                        {corriendo && (
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-[10px] text-indigo-200 font-medium">CORRIENDO</span>
                          </div>
                        )}
                        {!corriendo && (
                          <p className="text-[10px] text-gray-400 font-medium mt-1">PAUSADO</p>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <Link
                              to={`/casos/${timer.caso.id}`}
                              className="text-sm font-bold text-indigo-700 hover:underline font-mono"
                            >
                              {timer.caso.numero}
                            </Link>
                            <p className="text-sm font-medium text-gray-800 truncate">{timer.caso.titulo}</p>
                            {timer.descripcion && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{timer.descripcion}</p>
                            )}
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                          {corriendo ? (
                            <button
                              onClick={() => mutPausar.mutate(timer.id)}
                              disabled={mutPausar.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors disabled:opacity-50"
                            >
                              <Pause className="w-3.5 h-3.5" /> Pausar
                            </button>
                          ) : (
                            <button
                              onClick={() => mutReanudar.mutate(timer.id)}
                              disabled={mutReanudar.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                            >
                              <Play className="w-3.5 h-3.5" /> Reanudar
                            </button>
                          )}
                          <button
                            onClick={() => setStopModal({ timer, liveSeconds })}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                          >
                            <Square className="w-3.5 h-3.5" /> Detener
                          </button>
                          <button
                            onClick={() => mutDescartar.mutate(timer.id)}
                            disabled={mutDescartar.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Descartar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tip */}
        {timers.length > 0 && (
          <p className="text-xs text-gray-400 text-center">
            Al detener un timer se crea automáticamente un registro de horas vinculado al caso.
          </p>
        )}
      </div>

      {/* Stop modal */}
      {stopModal && (
        <StopModal
          timer={stopModal.timer}
          liveSeconds={stopModal.liveSeconds}
          now={now}
          onClose={() => setStopModal(null)}
          onSuccess={() => {
            setStopModal(null);
            qc.invalidateQueries({ queryKey: ['mis-timers'] });
          }}
        />
      )}
    </div>
  );
}

// ─── NUEVO TIMER PANEL ────────────────────────────────────────────────────────

function NuevoTimerPanel({ onClose, onSuccess }) {
  const [casoId, setCasoId] = useState('');
  const [descripcion, setDescripcion] = useState('');

  const { data: casosResp } = useQuery({
    queryKey: ['casos-select'],
    queryFn: () => getCasos({ estado: 'ACTIVO', porPagina: 100 }),
  });
  const casos = casosResp?.datos ?? [];

  const mutation = useMutation({
    mutationFn: () => iniciarTimer(casoId, descripcion || undefined),
    onSuccess: (data) => {
      toast.success(data.accion === 'reanudado' ? 'Timer reanudado' : 'Timer iniciado');
      onSuccess();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al iniciar timer'),
  });

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Play className="w-4 h-4 text-indigo-600" /> Iniciar nuevo timer
        </h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Caso <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={casoId}
            onChange={(e) => setCasoId(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Seleccionar caso activo...</option>
            {casos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero} — {c.titulo}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción de la tarea (opcional)</label>
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Redacción de demanda, Revisión de pruebas..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={() => mutation.mutate()}
          disabled={!casoId || mutation.isPending}
          className="w-full py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          {mutation.isPending ? 'Iniciando...' : 'Iniciar timer'}
        </button>
      </div>
    </div>
  );
}

// ─── STOP MODAL ───────────────────────────────────────────────────────────────

function StopModal({ timer, liveSeconds, now, onClose, onSuccess }) {
  const [descripcion, setDescripcion] = useState(timer.descripcion || '');
  const [facturable, setFacturable] = useState(true);
  const [redondear, setRedondear] = useState(false);

  const horasBase = liveSeconds / 3600;
  const horasRedondeadas = Math.ceil(horasBase * 4) / 4;
  const horasMostrar = redondear ? horasRedondeadas : Math.round(horasBase * 100) / 100;

  const mutation = useMutation({
    mutationFn: () => detenerTimer(timer.id, {
      descripcion: descripcion || undefined,
      facturable,
      redondearCuartoHora: redondear,
    }),
    onSuccess: (data) => {
      if (data.registro) {
        toast.success(`${data.horasRegistradas}h registradas en ${timer.caso.numero}`);
      } else {
        toast(data.mensaje || 'Timer detenido', { icon: 'ℹ️' });
      }
      onSuccess();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error'),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Detener timer</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Summary */}
          <div className="bg-indigo-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold font-mono text-indigo-700">{formatTime(liveSeconds)}</p>
            <p className="text-sm text-indigo-500 mt-1">{timer.caso.numero} — {timer.caso.titulo}</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción del trabajo realizado</label>
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="¿Qué hiciste durante este tiempo?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setFacturable((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative ${facturable ? 'bg-indigo-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${facturable ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Facturable al cliente</p>
                <p className="text-xs text-gray-400">Se incluirá en la facturación del caso</p>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setRedondear((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${redondear ? 'bg-indigo-600' : 'bg-gray-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${redondear ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Redondear a cuartos de hora</p>
                <p className="text-xs text-gray-400">Práctica estándar en facturación legal</p>
              </div>
            </label>
          </div>

          {/* Hours preview */}
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl">
            <span className="text-sm text-gray-600">Horas a registrar</span>
            <span className="text-lg font-bold text-gray-900">{horasMostrar.toFixed(2)} h</span>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Guardando...' : `Registrar ${horasMostrar.toFixed(2)}h`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
