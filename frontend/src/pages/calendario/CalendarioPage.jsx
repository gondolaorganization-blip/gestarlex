import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCalendarioMensual, getCalendarioSemanal, getAlertas } from '../../api/calendario';
import { format, parseISO, addMonths, subMonths, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DIAS_CABECERA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function getSemaforoStyle(semaforo) {
  switch (semaforo) {
    case 'VENCIDO':    return { pill: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-500' };
    case 'ROJO':       return { pill: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-400' };
    case 'NARANJA':    return { pill: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-400' };
    case 'AMARILLO':   return { pill: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400' };
    case 'VERDE':      return { pill: 'bg-green-100 text-green-700 border-green-200',   dot: 'bg-green-500' };
    case 'COMPLETADO': return { pill: 'bg-gray-100 text-gray-400 border-gray-200',      dot: 'bg-gray-300' };
    default:           return { pill: 'bg-gray-100 text-gray-500 border-gray-200',      dot: 'bg-gray-400' };
  }
}

// ─── MONTH GRID BUILDER ────────────────────────────────────────────────────────

function buildMonthGrid(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Day of week, Mon-first (0=Mon…6=Sun)
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  const cells = [];

  // Leading days from previous month
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, -i), currentMonth: false });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month - 1, d), currentMonth: true });
  }
  // Trailing days to complete last row
  const remaining = cells.length % 7;
  if (remaining > 0) {
    for (let d = 1; d <= 7 - remaining; d++) {
      cells.push({ date: new Date(year, month, d), currentMonth: false });
    }
  }
  return cells;
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function CalendarioPage() {
  const [view, setView] = useState('mensual');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const currentDateStr = format(currentDate, 'yyyy-MM-dd');
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: mensualData, isLoading: loadingMensual } = useQuery({
    queryKey: ['calendario-mensual', year, month],
    queryFn: () => getCalendarioMensual(year, month),
    enabled: view === 'mensual',
  });

  const { data: semanalData, isLoading: loadingSemanal } = useQuery({
    queryKey: ['calendario-semanal', currentDateStr],
    queryFn: () => getCalendarioSemanal(currentDateStr),
    enabled: view === 'semanal',
  });

  const { data: alertas } = useQuery({
    queryKey: ['calendario-alertas'],
    queryFn: getAlertas,
    refetchInterval: 60_000,
  });

  const gridCells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const selectedEvents = mensualData?.dias?.[selectedDate] ?? { audiencias: [], terminos: [] };
  const totalEventsSelected = selectedEvents.audiencias.length + selectedEvents.terminos.length;
  const criticos = alertas?.resumen?.criticos ?? 0;

  const navPrev = () => {
    if (view === 'mensual') setCurrentDate((d) => subMonths(d, 1));
    else setCurrentDate((d) => subWeeks(d, 1));
  };
  const navNext = () => {
    if (view === 'mensual') setCurrentDate((d) => addMonths(d, 1));
    else setCurrentDate((d) => addWeeks(d, 1));
  };
  const goToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(todayStr);
  };

  let rangoLabel = '';
  if (view === 'mensual') {
    rangoLabel = `${MESES_ES[month - 1]} ${year}`;
  } else if (semanalData) {
    rangoLabel = `${format(parseISO(semanalData.inicio), "d MMM", { locale: es })} – ${format(parseISO(semanalData.fin), "d MMM yyyy", { locale: es })}`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">Calendario Judicial</h1>
              {view === 'mensual' && mensualData && (
                <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                    {mensualData.totalAudiencias} audiencias
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                    {mensualData.totalTerminos} términos
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* View toggle */}
              <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
                <button
                  onClick={() => setView('mensual')}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    view === 'mensual' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Mensual
                </button>
                <button
                  onClick={() => setView('semanal')}
                  className={`px-3 py-1.5 font-medium border-l border-gray-200 transition-colors ${
                    view === 'semanal' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Semanal
                </button>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-1">
                <button onClick={navPrev} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={goToday}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Hoy
                </button>
                <button onClick={navNext} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <span className="text-sm font-semibold text-gray-700 min-w-[160px]">{rangoLabel}</span>
            </div>
          </div>

          {/* Alert banner */}
          {criticos > 0 && (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-700 font-medium">
                {criticos} {criticos === 1 ? 'evento crítico requiere' : 'eventos críticos requieren'} atención inmediata
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {view === 'mensual' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar grid */}
            <div className="lg:col-span-2">
              {loadingMensual ? (
                <div className="flex justify-center py-16"><Spinner size="lg" /></div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Day-of-week headers */}
                  <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
                    {DIAS_CABECERA.map((d) => (
                      <div key={d} className="py-2 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Cells */}
                  <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
                    {gridCells.map((cell, i) => {
                      const dateKey = format(cell.date, 'yyyy-MM-dd');
                      const events = mensualData?.dias?.[dateKey] ?? { audiencias: [], terminos: [] };
                      const totalInCell = events.audiencias.length + events.terminos.length;
                      const isTodayCell = dateKey === todayStr;
                      const isSelected = dateKey === selectedDate;

                      // How many pills to show (max 3 total)
                      const maxAud = Math.min(events.audiencias.length, 2);
                      const maxTer = Math.min(events.terminos.length, 3 - maxAud);
                      const shown = maxAud + maxTer;
                      const extra = totalInCell - shown;

                      return (
                        <button
                          key={i}
                          onClick={() => cell.currentMonth && setSelectedDate(dateKey)}
                          disabled={!cell.currentMonth}
                          className={`min-h-[84px] p-1.5 text-left transition-colors ${
                            !cell.currentMonth
                              ? 'bg-gray-50 cursor-default'
                              : isSelected
                              ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400'
                              : 'hover:bg-gray-50 cursor-pointer'
                          }`}
                        >
                          {/* Day number */}
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mb-1 ${
                            isTodayCell
                              ? 'bg-indigo-600 text-white'
                              : cell.currentMonth
                              ? 'text-gray-800'
                              : 'text-gray-300'
                          }`}>
                            {cell.date.getDate()}
                          </span>

                          {/* Event pills */}
                          <div className="space-y-0.5">
                            {events.audiencias.slice(0, maxAud).map((a, j) => (
                              <div
                                key={j}
                                className="text-[10px] px-1 py-0.5 bg-indigo-100 text-indigo-700 rounded truncate leading-tight"
                              >
                                {a.hora ? a.hora.slice(0, 5) + ' ' : ''}{a.caso.numero}
                              </div>
                            ))}
                            {events.terminos.slice(0, maxTer).map((t, j) => {
                              const s = getSemaforoStyle(t.semaforo);
                              return (
                                <div
                                  key={j}
                                  className={`text-[10px] px-1 py-0.5 rounded border truncate leading-tight ${s.pill}`}
                                >
                                  {t.caso.numero}
                                </div>
                              );
                            })}
                            {extra > 0 && (
                              <div className="text-[10px] text-gray-400 px-1">+{extra} más</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 px-1 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-200 inline-block" />
                  Audiencia
                </span>
                {[
                  ['Vencido / Hoy', 'bg-red-100 border-red-200'],
                  ['≤ 3 días', 'bg-orange-100 border-orange-200'],
                  ['≤ 7 días', 'bg-yellow-100 border-yellow-200'],
                  ['> 7 días', 'bg-green-100 border-green-200'],
                ].map(([label, cls]) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className={`w-3 h-3 rounded ${cls} border inline-block`} />
                    Término {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Right panel */}
            <div className="space-y-4">
              {/* Selected day detail */}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3 capitalize">
                  {selectedDate === todayStr
                    ? 'Hoy'
                    : format(parseISO(selectedDate), "EEEE d 'de' MMMM", { locale: es })}
                  {totalEventsSelected > 0 && (
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      · {totalEventsSelected} {totalEventsSelected === 1 ? 'evento' : 'eventos'}
                    </span>
                  )}
                </h2>

                {totalEventsSelected === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">Sin eventos este día</p>
                ) : (
                  <div className="space-y-2">
                    {selectedEvents.audiencias.map((a) => (
                      <Link key={a.id} to={`/casos/${a.caso.id}`} className="block group">
                        <div className="flex gap-2.5 p-2.5 rounded-lg hover:bg-indigo-50 transition-colors border border-transparent hover:border-indigo-100">
                          <div className="w-1 rounded-full bg-indigo-500 shrink-0 self-stretch" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                {a.caso.numero}
                              </span>
                              {a.hora && (
                                <span className="text-xs text-gray-400 flex items-center gap-0.5">
                                  <Clock className="w-3 h-3" /> {a.hora.slice(0, 5)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-gray-700 truncate">{a.titulo || a.tipo || 'Audiencia'}</p>
                            {a.juzgado && <p className="text-xs text-gray-400 truncate">{a.juzgado}{a.sala ? ` · ${a.sala}` : ''}</p>}
                            <p className="text-xs text-gray-400 truncate">{a.caso.cliente?.nombre}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {selectedEvents.terminos.map((t) => {
                      const s = getSemaforoStyle(t.semaforo);
                      return (
                        <Link key={t.id} to={`/casos/${t.caso.id}`} className="block group">
                          <div className="flex gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                            <div className={`w-1 rounded-full ${s.dot} shrink-0 self-stretch`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-xs font-bold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {t.caso.numero}
                                </span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${s.pill}`}>
                                  {t.semaforo}
                                </span>
                              </div>
                              <p className="text-xs text-gray-600 truncate">{t.descripcion}</p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Alertas críticas */}
              {alertas && (alertas.audiencias.some((a) => a.nivelAlerta === 'CRITICA') || alertas.terminosVencidos.length > 0) && (
                <div className="bg-white rounded-xl border border-red-200 p-4">
                  <h2 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4" />
                    Alertas críticas
                  </h2>
                  <div className="space-y-1.5">
                    {alertas.audiencias
                      .filter((a) => a.nivelAlerta === 'CRITICA')
                      .map((a) => (
                        <Link key={a.id} to={`/casos/${a.caso.id}`} className="block">
                          <div className="flex gap-2 p-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                            <div className="w-1 rounded-full bg-red-500 shrink-0 self-stretch" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-red-700 truncate">
                                Audiencia · {a.caso.numero}
                              </p>
                              <p className="text-xs text-red-500">
                                {a.diasRestantes <= 0 ? 'Hoy' : `En ${a.diasRestantes} día${a.diasRestantes === 1 ? '' : 's'}`}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    {alertas.terminosVencidos.slice(0, 5).map((t) => (
                      <Link key={t.id} to={`/casos/${t.caso.id}`} className="block">
                        <div className="flex gap-2 p-2 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                          <div className="w-1 rounded-full bg-red-700 shrink-0 self-stretch" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-red-700 truncate">
                              Término vencido · {t.caso.numero}
                            </p>
                            <p className="text-xs text-red-500 truncate">{t.descripcion}</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Próximos términos */}
              {alertas?.terminosProximos?.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">Próximos vencimientos</h2>
                  <div className="space-y-1.5">
                    {alertas.terminosProximos.slice(0, 6).map((t) => {
                      const s = getSemaforoStyle(t.semaforo);
                      return (
                        <Link key={t.id} to={`/casos/${t.caso.id}`} className="block">
                          <div className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <div className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-700 truncate">
                                {t.caso.numero}: {t.descripcion}
                              </p>
                              <p className="text-xs text-gray-400">
                                {t.diasRestantes === 0 ? 'Hoy' : `${t.diasRestantes} día${t.diasRestantes === 1 ? '' : 's'}`}
                              </p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <WeeklyView data={semanalData} isLoading={loadingSemanal} todayStr={todayStr} />
        )}
      </div>
    </div>
  );
}

// ─── WEEKLY VIEW ──────────────────────────────────────────────────────────────

function WeeklyView({ data, isLoading, todayStr }) {
  if (isLoading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
      {data.semana.map((dia) => {
        const isTodayCol = dia.fecha === todayStr;
        const hasEvents = dia.audiencias.length > 0 || dia.terminos.length > 0;

        return (
          <div
            key={dia.fecha}
            className={`bg-white rounded-xl border overflow-hidden ${
              isTodayCol ? 'border-indigo-300 shadow-md' : 'border-gray-200'
            }`}
          >
            {/* Day header */}
            <div className={`px-3 py-2.5 text-center border-b ${
              isTodayCol ? 'bg-indigo-600 border-indigo-500' : 'bg-gray-50 border-gray-100'
            }`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${isTodayCol ? 'text-indigo-200' : 'text-gray-400'}`}>
                {dia.diaSemana.slice(0, 3)}
              </p>
              <p className={`text-xl font-bold ${isTodayCol ? 'text-white' : 'text-gray-800'}`}>
                {parseInt(dia.fecha.split('-')[2])}
              </p>
            </div>

            {/* Events */}
            <div className="p-2 space-y-1.5 min-h-[120px]">
              {!hasEvents && (
                <p className="text-xs text-gray-300 text-center pt-6">—</p>
              )}
              {dia.audiencias.map((a) => (
                <Link key={a.id} to={`/casos/${a.caso.id}`} className="block">
                  <div className="p-1.5 bg-indigo-50 border border-indigo-100 rounded-lg hover:border-indigo-300 transition-colors">
                    {a.hora && (
                      <p className="text-[10px] font-bold text-indigo-700 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {a.hora.slice(0, 5)}
                      </p>
                    )}
                    <p className="text-[10px] font-semibold text-indigo-700 truncate">{a.caso.numero}</p>
                    <p className="text-[10px] text-indigo-500 truncate">{a.titulo || a.tipo || 'Audiencia'}</p>
                    {a.juzgado && <p className="text-[10px] text-indigo-400 truncate">{a.juzgado}</p>}
                  </div>
                </Link>
              ))}
              {dia.terminos.map((t) => {
                const s = getSemaforoStyle(t.semaforo);
                return (
                  <Link key={t.id} to={`/casos/${t.caso.id}`} className="block">
                    <div className={`p-1.5 border rounded-lg hover:opacity-80 transition-opacity ${s.pill}`}>
                      <p className="text-[10px] font-semibold truncate">{t.caso.numero}</p>
                      <p className="text-[10px] truncate">{t.descripcion}</p>
                      <p className="text-[10px] font-medium">{t.semaforo}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
