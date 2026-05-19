import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getPlantillas, getPlantilla, renderizarPlantilla } from '../../api/plantillas';
import Spinner from '../../components/ui/Spinner';
import {
  FileText, Scale, Briefcase, DollarSign,
  ChevronRight, X, Copy, Printer, Check, ArrowLeft,
} from 'lucide-react';

const TIPO_META = {
  CIVIL:      { label: 'Civil',      cls: 'bg-blue-100 text-blue-700',    icon: Scale },
  LABORAL:    { label: 'Laboral',    cls: 'bg-green-100 text-green-700',  icon: Briefcase },
  PODER:      { label: 'Poder',      cls: 'bg-purple-100 text-purple-700', icon: FileText },
  HONORARIOS: { label: 'Honorarios', cls: 'bg-amber-100 text-amber-700',  icon: DollarSign },
};

const TIPOS = ['TODOS', 'CIVIL', 'LABORAL', 'PODER', 'HONORARIOS'];

// Human-friendly labels for variable names
const VAR_LABELS = {
  demandante: 'Demandante',
  demandado: 'Demandado',
  juzgado: 'Juzgado',
  pretension: 'Pretensión',
  hechos: 'Hechos',
  fundamentos: 'Fundamentos de derecho',
  abogado: 'Nombre del abogado(a)',
  idoneidad: 'No. de idoneidad',
  expediente: 'No. de expediente',
  excepciones: 'Excepciones',
  poderdante: 'Poderdante',
  cedulaPoderdante: 'Cédula del poderdante',
  materia: 'Materia del poder',
  notaria: 'Notaría',
  ciudad: 'Ciudad',
  resolucioApelada: 'Fecha de resolución apelada',
  agravios: 'Agravios',
  apelante: 'Apelante',
  trabajador: 'Nombre del trabajador',
  cedula: 'Cédula del trabajador',
  empleador: 'Empleador',
  cargo: 'Cargo',
  salario: 'Salario mensual (B/.)',
  fechaIngreso: 'Fecha de ingreso',
  fechaDespido: 'Fecha de despido/terminación',
  pretensiones: 'Pretensiones',
  firma: 'Nombre de la firma',
  cliente: 'Cliente',
  caso: 'Descripción del caso',
  monto: 'Monto total (B/.)',
  concepto: 'Concepto detallado',
  cuentaBancaria: 'Datos de cuenta bancaria',
  fecha: 'Fecha',
};

// Variables that benefit from textarea
const MULTILINE_VARS = new Set([
  'hechos', 'fundamentos', 'pretension', 'pretensiones',
  'excepciones', 'agravios', 'concepto',
]);

function TipoBadge({ tipo }) {
  const meta = TIPO_META[tipo] ?? { label: tipo, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function PlantillaCard({ plantilla, onClick }) {
  const meta = TIPO_META[plantilla.tipo] ?? {};
  const Icon = meta.icon ?? FileText;
  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${meta.cls ?? 'bg-gray-100'}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-gray-900 text-sm">{plantilla.nombre}</h3>
              <TipoBadge tipo={plantilla.tipo} />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">{plantilla.descripcion}</p>
            <p className="text-xs text-gray-400 mt-2">
              {plantilla.variables.length} variable{plantilla.variables.length !== 1 ? 's' : ''}:{' '}
              {plantilla.variables.slice(0, 4).join(', ')}
              {plantilla.variables.length > 4 && ` +${plantilla.variables.length - 4} más`}
            </p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 mt-1 shrink-0 transition-colors" />
      </div>
    </button>
  );
}

function VariableInput({ varName, value, onChange }) {
  const label = VAR_LABELS[varName] ?? varName;
  const isMulti = MULTILINE_VARS.has(varName);

  if (isMulti) {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          {label}
        </label>
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(varName, e.target.value)}
          placeholder={`Ingrese ${label.toLowerCase()}…`}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
    );
  }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(varName, e.target.value)}
        placeholder={`Ingrese ${label.toLowerCase()}…`}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  );
}

function DocumentPreview({ nombre, contenido, onClose }) {
  const [copied, setCopied] = useState(false);
  const printRef = useRef(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(contenido);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-100">
      {/* Print toolbar — hidden on print */}
      <div className="no-print flex items-center justify-between bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <span className="text-gray-300">|</span>
          <h2 className="text-sm font-semibold text-gray-800">{nombre}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado' : 'Copiar texto'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Scrollable document area */}
      <div className="flex-1 overflow-y-auto py-8 px-4">
        <div
          ref={printRef}
          id="plantilla-print"
          className="bg-white mx-auto shadow-sm rounded-lg print-doc"
          style={{ maxWidth: 720, minHeight: 1000, padding: '60px 72px', fontFamily: 'Georgia, serif' }}
        >
          <pre
            className="whitespace-pre-wrap text-sm leading-relaxed text-gray-900"
            style={{ fontFamily: 'inherit', fontSize: '13px', lineHeight: '1.8' }}
          >
            {contenido}
          </pre>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: 8.5in 14.0in; margin: 2.5cm; }
          .no-print { display: none !important; }
          body { background: white !important; }
          #plantilla-print {
            box-shadow: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function PlantillasPage() {
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [selected, setSelected] = useState(null);   // plantilla seleccionada (objeto completo con variables)
  const [vars, setVars] = useState({});              // valores de las variables
  const [preview, setPreview] = useState(null);      // { nombre, contenido }

  const { data: plantillas = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['plantillas'],
    queryFn: getPlantillas,
  });

  const { data: plantillaDetalle, isFetching: loadingDetalle } = useQuery({
    queryKey: ['plantilla', selected?.id],
    queryFn: () => getPlantilla(selected.id),
    enabled: !!selected?.id,
  });

  const renderMutation = useMutation({
    mutationFn: ({ id, variables }) => renderizarPlantilla(id, variables),
    onSuccess: (data) => setPreview(data),
  });

  const handleSelect = (p) => {
    setSelected(p);
    const init = {};
    p.variables.forEach((v) => { init[v] = ''; });
    setVars(init);
    setPreview(null);
  };

  const handleVarChange = (key, value) => {
    setVars((prev) => ({ ...prev, [key]: value }));
  };

  const handleRender = () => {
    renderMutation.mutate({ id: selected.id, variables: vars });
  };

  const handleBack = () => {
    setSelected(null);
    setVars({});
    setPreview(null);
  };

  const filtered = filtroTipo === 'TODOS'
    ? plantillas
    : plantillas.filter((p) => p.tipo === filtroTipo);

  // Full-screen document preview
  if (preview) {
    return (
      <DocumentPreview
        nombre={preview.nombre}
        contenido={preview.contenido}
        onClose={() => setPreview(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3 mb-1">
            {selected && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <FileText className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-bold text-gray-900">
              {selected ? selected.nombre : 'Plantillas de Escritos'}
            </h1>
            {selected && <TipoBadge tipo={selected.tipo} />}
          </div>
          {!selected && (
            <p className="text-sm text-gray-500 ml-8">
              Escritos jurídicos panameños — Ley 402 de 2023 · Acuerdo 49 de 2001
            </p>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* ── Lista de plantillas ─────────────────────────────────── */}
        {!selected && (
          <>
            {/* Filtro por tipo */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  onClick={() => setFiltroTipo(t)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    filtroTipo === t
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {t === 'TODOS' ? 'Todos' : TIPO_META[t]?.label ?? t}
                  {t !== 'TODOS' && (
                    <span className="ml-1.5 text-xs opacity-70">
                      ({plantillas.filter((p) => p.tipo === t).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Spinner size="lg" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
                <p className="text-sm text-red-600 font-medium">
                  Error al cargar plantillas: {error?.response?.data?.message || error?.message || 'Error de conexión'}
                </p>
                <button
                  onClick={() => refetch()}
                  className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Reintentar
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
                Sin plantillas para el filtro seleccionado
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((p) => (
                  <PlantillaCard
                    key={p.id}
                    plantilla={p}
                    onClick={() => handleSelect(p)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Editor de variables ─────────────────────────────────── */}
        {selected && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Variables form — left 2/5 */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-800 mb-4">
                  Datos del documento
                </h2>
                <div className="space-y-4">
                  {selected.variables.map((v) => (
                    <VariableInput
                      key={v}
                      varName={v}
                      value={vars[v] ?? ''}
                      onChange={handleVarChange}
                    />
                  ))}
                </div>
                <button
                  onClick={handleRender}
                  disabled={renderMutation.isPending}
                  className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {renderMutation.isPending ? (
                    <Spinner size="sm" />
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Generar documento
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Template preview — right 3/5 */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6">
                <h2 className="text-sm font-semibold text-gray-800 mb-4">
                  Vista previa de estructura
                </h2>
                <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-[560px]">
                  {loadingDetalle ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                  ) : (
                    <pre
                      className="text-xs leading-relaxed text-gray-600 whitespace-pre-wrap"
                      style={{ fontFamily: 'Georgia, serif' }}
                    >
                      {plantillaDetalle?.contenido
                        ? renderTemplateWithHighlights(plantillaDetalle.contenido, vars)
                        : ''}
                    </pre>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Los campos en{' '}
                  <span className="font-semibold text-indigo-500">[corchetes]</span>{' '}
                  se completarán con los datos ingresados.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Returns segments with placeholder detection for inline highlight rendering
function renderTemplateWithHighlights(contenido, vars) {
  // Replace filled vars with their values, leave empty as [varName]
  let text = contenido;
  const allVarMatches = [...text.matchAll(/\{\{(\w+)\}\}/g)];
  for (const match of allVarMatches) {
    const key = match[1];
    const val = vars[key];
    text = text.replaceAll(`{{${key}}}`, val ? val : `[${VAR_LABELS[key] ?? key}]`);
  }
  return text;
}
