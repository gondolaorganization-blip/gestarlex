import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Calendar, Link2, Unlink, RefreshCw, AlertTriangle, ShieldCheck,
  FlaskConical, CheckCircle2, XCircle, Clock, ArrowRight,
} from 'lucide-react';
import {
  getEstadoGoogle, iniciarConexionGoogle, desconectarGoogle,
  probarEmpuje, sincronizarEntrada, sincronizarTodo, habilitarSyncCompleto,
  getIncidencias, resolverIncidencia,
} from '../../api/google';

const TIPOS = [
  { valor: 'AUDIENCIA', etiqueta: 'Audiencia' },
  { valor: 'TERMINO', etiqueta: 'Término procesal' },
  { valor: 'TAREA', etiqueta: 'Tarea' },
];

const ETIQUETA_RESOLUCION = {
  GESTARLEX: 'Que gane GestarLex',
  GOOGLE: 'Que gane Google',
  IGNORAR: 'Ignorar',
  BORRAR_LOCAL: 'Borrar también en GestarLex',
  RESTAURAR_EN_GOOGLE: 'Volver a crearlo en Google',
  BORRAR_EN_GOOGLE: 'Borrar también en Google',
};

const RESOLUCION_DESTRUCTIVA = ['BORRAR_LOCAL', 'BORRAR_EN_GOOGLE'];

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

function Incidencia({ incidencia, onResolver, resolviendo }) {
  const esConflicto = incidencia.tipo === 'CONFLICTO';

  return (
    <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">{incidencia.titulo}</p>
          <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">{incidencia.detalle}</p>

          {incidencia.diferencias?.length > 0 && (
            <div className="mt-3 rounded-md border border-gray-200 bg-white overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left font-medium px-3 py-1.5">Campo</th>
                    <th className="text-left font-medium px-3 py-1.5">En GestarLex</th>
                    <th className="text-left font-medium px-3 py-1.5">En Google</th>
                  </tr>
                </thead>
                <tbody>
                  {incidencia.diferencias.map((d) => (
                    <tr key={d.campo} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 text-gray-500">{d.campo}</td>
                      <td className="px-3 py-1.5 text-gray-900">{d.gestarlex}</td>
                      <td className="px-3 py-1.5 text-gray-900">{d.google}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {incidencia.opciones.map((op) => {
              const destructiva = RESOLUCION_DESTRUCTIVA.includes(op);
              return (
                <button
                  key={op}
                  disabled={resolviendo}
                  onClick={() => onResolver(incidencia.id, op, destructiva)}
                  className={`text-xs px-3 py-1.5 rounded-md border font-medium disabled:opacity-50 ${
                    destructiva
                      ? 'border-red-300 text-red-700 hover:bg-red-50'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {ETIQUETA_RESOLUCION[op] || op}
                </button>
              );
            })}
          </div>

          {!esConflicto && (
            <p className="text-[11px] text-gray-500 mt-2">
              Nada fue borrado todavía. Solo se borra si elegís explícitamente esa opción.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GoogleCalendarPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [prueba, setPrueba] = useState({ tipo: 'AUDIENCIA', id: '' });
  const [resultadoPrueba, setResultadoPrueba] = useState(null);

  // Mensajes que vuelven del callback de OAuth
  useEffect(() => {
    if (params.get('conectado')) {
      toast.success(`Google Calendar conectado — calendario "${params.get('calendario')}"`);
      setParams({}, { replace: true });
    } else if (params.get('error')) {
      toast.error(params.get('error'), { duration: 12000 });
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const { data: estado, isLoading } = useQuery({
    queryKey: ['google', 'estado'],
    queryFn: getEstadoGoogle,
  });

  const { data: incidencias = [] } = useQuery({
    queryKey: ['google', 'incidencias'],
    queryFn: () => getIncidencias('PENDIENTE'),
    enabled: !!estado?.conectada,
  });

  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['google'] });
  };

  const conectar = useMutation({
    mutationFn: iniciarConexionGoogle,
    onSuccess: (url) => { window.location.href = url; },
    onError: (e) => toast.error(e.response?.data?.message ?? 'No se pudo iniciar la conexión.'),
  });

  const desconectar = useMutation({
    mutationFn: desconectarGoogle,
    onSuccess: (r) => { toast.success(r.mensaje); refrescar(); },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Error al desconectar.'),
  });

  const empujarPrueba = useMutation({
    mutationFn: () => probarEmpuje(prueba.tipo, prueba.id.trim()),
    onSuccess: (r) => {
      setResultadoPrueba(r);
      toast.success(`Resultado: ${r.resultado.accion}`);
      refrescar();
    },
    onError: (e) => {
      setResultadoPrueba(null);
      toast.error(e.response?.data?.message ?? 'Error en la prueba.');
    },
  });

  const traerDeGoogle = useMutation({
    mutationFn: sincronizarEntrada,
    onSuccess: (r) => {
      const e = r.entrada;
      toast.success(
        `Revisados ${e.revisados} · externos nuevos ${e.externos_creados} · ` +
        `locales actualizados ${e.locales_actualizados} · conflictos ${e.conflictos}`,
        { duration: 8000 }
      );
      refrescar();
    },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Error al traer de Google.'),
  });

  const syncCompleto = useMutation({
    mutationFn: sincronizarTodo,
    onSuccess: () => { toast.success('Sincronización completa terminada.'); refrescar(); },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Error en el sync completo.', { duration: 10000 }),
  });

  const interruptor = useMutation({
    mutationFn: habilitarSyncCompleto,
    onSuccess: (r) => { toast.success(r.mensaje); refrescar(); },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Error.'),
  });

  const resolver = useMutation({
    mutationFn: ({ id, resolucion }) => resolverIncidencia(id, resolucion),
    onSuccess: () => { toast.success('Incidencia resuelta.'); refrescar(); },
    onError: (e) => toast.error(e.response?.data?.message ?? 'Error al resolver.'),
  });

  const onResolver = (id, resolucion, destructiva) => {
    if (destructiva) {
      const texto = resolucion === 'BORRAR_LOCAL'
        ? '¿Borrar el registro en GestarLex? Esta acción no se puede deshacer.'
        : '¿Borrar el evento en Google Calendar? Esta acción no se puede deshacer.';
      if (!window.confirm(texto)) return;
    }
    resolver.mutate({ id, resolucion });
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">Cargando…</div>;
  }

  const conectada = estado?.conectada;

  return (
    <div className="p-6 max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-500" />
          Google Calendar
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Sincronización bidireccional con tu calendario secundario "GestarLex".
        </p>
      </div>

      {/* ── CONEXIÓN ─────────────────────────────────────────────── */}
      <SectionCard title="Conexión" icon={Link2}>
        {conectada ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-gray-900 font-medium">{estado.googleEmail}</span>
              <span className="text-gray-400">→</span>
              <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-xs font-medium">
                {estado.calendarSummary}
              </span>
            </div>

            <div className="flex items-start gap-2 text-xs text-gray-600 bg-green-50 border border-green-200 rounded-md p-3">
              <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-px" />
              <span>
                Los eventos del despacho van <strong>solo</strong> a "{estado.calendarSummary}".
                El calendario personal principal está bloqueado por código: ninguna operación
                puede escribir ahí.
              </span>
            </div>

            <div className="text-xs text-gray-500 flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Último sync: {estado.ultimoSyncEn ? new Date(estado.ultimoSyncEn).toLocaleString('es-PA') : 'nunca'}
              </span>
              {estado.ultimoError && <span className="text-red-600">Último error: {estado.ultimoError}</span>}
            </div>

            <button
              onClick={() => window.confirm('¿Desconectar Google Calendar? No se borrará ningún evento.') && desconectar.mutate()}
              disabled={desconectar.isPending}
              className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Unlink className="w-3 h-3" /> Desconectar
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Todavía no hay ninguna cuenta de Google conectada.
            </p>
            <button
              onClick={() => conectar.mutate()}
              disabled={conectar.isPending}
              className="text-sm px-4 py-2 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700 inline-flex items-center gap-2 disabled:opacity-50"
            >
              <Link2 className="w-4 h-4" />
              {conectar.isPending ? 'Redirigiendo…' : 'Conectar Google Calendar'}
            </button>
            <p className="text-xs text-gray-500">
              Vas a ver una pantalla de Google que dice que la app no está verificada.
              Es esperable: la app es tuya. Elegí <em>Configuración avanzada → Ir a GestarLex</em>.
            </p>
          </div>
        )}
      </SectionCard>

      {conectada && (
        <>
          {/* ── PRUEBA DE UN EVENTO ───────────────────────────────── */}
          <SectionCard title="Prueba de un solo evento" icon={FlaskConical}>
            <p className="text-xs text-gray-600 mb-4">
              Empuja <strong>un</strong> registro a Google y muestra exactamente qué pasó.
              No toca nada más. Es el paso previo obligatorio antes de habilitar el sync automático.
            </p>

            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                <select
                  value={prueba.tipo}
                  onChange={(e) => setPrueba((p) => ({ ...p, tipo: e.target.value }))}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1.5"
                >
                  {TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[240px]">
                <label className="block text-xs text-gray-500 mb-1">ID del registro</label>
                <input
                  value={prueba.id}
                  onChange={(e) => setPrueba((p) => ({ ...p, id: e.target.value }))}
                  placeholder="cl..."
                  className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 font-mono"
                />
              </div>
              <button
                onClick={() => empujarPrueba.mutate()}
                disabled={!prueba.id.trim() || empujarPrueba.isPending}
                className="text-sm px-4 py-1.5 rounded-md bg-gray-900 text-white font-medium hover:bg-gray-800 inline-flex items-center gap-1.5 disabled:opacity-40"
              >
                <ArrowRight className="w-4 h-4" />
                {empujarPrueba.isPending ? 'Enviando…' : 'Empujar a Google'}
              </button>
            </div>

            {resultadoPrueba && (
              <pre className="mt-4 text-xs bg-gray-900 text-gray-100 rounded-md p-3 overflow-x-auto">
                {JSON.stringify(resultadoPrueba, null, 2)}
              </pre>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => traerDeGoogle.mutate()}
                disabled={traerDeGoogle.isPending}
                className="text-sm px-4 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${traerDeGoogle.isPending ? 'animate-spin' : ''}`} />
                Traer cambios de Google
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Lee solo lo que cambió desde la última vez. Seguro de correr las veces que quieras.
              </p>
            </div>
          </SectionCard>

          {/* ── INCIDENCIAS ───────────────────────────────────────── */}
          <SectionCard title={`Incidencias pendientes (${incidencias.length})`} icon={AlertTriangle}>
            {incidencias.length === 0 ? (
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Sin conflictos ni borrados pendientes.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  Nada de esto se resolvió solo. Ningún evento fue borrado ni sobrescrito:
                  el sync se detuvo y espera tu decisión.
                </p>
                {incidencias.map((i) => (
                  <Incidencia
                    key={i.id}
                    incidencia={i}
                    onResolver={onResolver}
                    resolviendo={resolver.isPending}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* ── SYNC AUTOMÁTICO ───────────────────────────────────── */}
          <SectionCard title="Sincronización automática" icon={RefreshCw}>
            <div className="flex items-start gap-3">
              {estado.syncCompletoHabilitado ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-400 shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {estado.syncCompletoHabilitado ? 'Habilitada' : 'Deshabilitada'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {estado.syncCompletoHabilitado
                    ? 'El cron sincroniza cada 10 minutos y los eventos nuevos se empujan al crearlos.'
                    : 'Mientras esté deshabilitada, lo único que escribe en Google es la prueba manual de arriba. Habilitala recién cuando la prueba haya funcionado en las dos direcciones.'}
                </p>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => interruptor.mutate(!estado.syncCompletoHabilitado)}
                    disabled={interruptor.isPending}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium disabled:opacity-50 ${
                      estado.syncCompletoHabilitado
                        ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {estado.syncCompletoHabilitado ? 'Deshabilitar' : 'Habilitar sync automático'}
                  </button>

                  {estado.syncCompletoHabilitado && (
                    <button
                      onClick={() => syncCompleto.mutate()}
                      disabled={syncCompleto.isPending}
                      className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {syncCompleto.isPending ? 'Sincronizando…' : 'Sincronizar todo ahora'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
