import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getEstadisticasDocumentos, subirDocumento } from '../../api/documentos';
import { getCasos } from '../../api/casos';
import { FileText, Upload, FolderOpen, Lock, ChevronDown, X, Check } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TIPOS_DOC = ['DEMANDA', 'SENTENCIA', 'PODER', 'CONTRATO', 'PRUEBA', 'COMUNICACION', 'FACTURA', 'OTRO'];
const TIPOS_DOC_LABELS = {
  DEMANDA: 'Demanda', SENTENCIA: 'Sentencia', PODER: 'Poder', CONTRATO: 'Contrato',
  PRUEBA: 'Prueba', COMUNICACION: 'Comunicación', FACTURA: 'Factura', OTRO: 'Otro',
};
const TIPOS_COLORS = {
  DEMANDA: 'bg-red-50 text-red-700', SENTENCIA: 'bg-purple-50 text-purple-700',
  PODER: 'bg-indigo-50 text-indigo-700', CONTRATO: 'bg-blue-50 text-blue-700',
  PRUEBA: 'bg-orange-50 text-orange-700', COMUNICACION: 'bg-green-50 text-green-700',
  FACTURA: 'bg-emerald-50 text-emerald-700', OTRO: 'bg-gray-50 text-gray-600',
};

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function DocumentosPage() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['documentos-stats'],
    queryFn: getEstadisticasDocumentos,
  });

  const { data: casosResp } = useQuery({
    queryKey: ['casos-con-docs'],
    queryFn: () => getCasos({ porPagina: 50, ordenPor: 'updatedAt', direccion: 'desc' }),
  });
  const casos = casosResp?.datos ?? [];
  const casosConDocs = casos.filter((c) => (c._count?.documentos ?? 0) > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Documentos</h1>
                <p className="text-xs text-gray-500">
                  {stats?.total ?? '—'} archivos · {stats?.confidenciales ?? 0} confidenciales
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUpload((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Subir documento
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        {/* Upload panel */}
        {showUpload && (
          <UploadPanel
            onClose={() => setShowUpload(false)}
            onSuccess={() => {
              setShowUpload(false);
              qc.invalidateQueries({ queryKey: ['documentos-stats'] });
              qc.invalidateQueries({ queryKey: ['casos-con-docs'] });
            }}
          />
        )}

        {/* Stats by tipo */}
        {stats && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Documentos por tipo</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {TIPOS_DOC.map((t) => {
                const entry = stats.porTipo?.find((p) => p.tipo === t);
                const count = entry?._count?.tipo ?? 0;
                return (
                  <div key={t} className={`p-3 rounded-xl text-center ${TIPOS_COLORS[t]}`}>
                    <p className="text-xl font-bold">{count}</p>
                    <p className="text-[10px] font-medium mt-0.5 uppercase tracking-wide">{TIPOS_DOC_LABELS[t]}</p>
                  </div>
                );
              })}
            </div>
            {stats.confidenciales > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 px-1">
                <Lock className="w-3.5 h-3.5 text-orange-500" />
                <span>{stats.confidenciales} documento{stats.confidenciales !== 1 ? 's' : ''} confidencial{stats.confidenciales !== 1 ? 'es' : ''} (solo SOCIO/ADMIN)</span>
              </div>
            )}
          </div>
        )}

        {/* Cases with documents */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-500" />
            Casos con documentos
          </h2>
          {casosConDocs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Ningún caso tiene documentos todavía</p>
              <p className="text-xs text-gray-400 mt-1">Sube documentos usando el botón de arriba</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {casosConDocs.map((c) => (
                <Link key={c.id} to={`/casos/${c.id}`} className="block group">
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-all">
                    <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
                      <FolderOpen className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-indigo-700 font-mono">{c.numero}</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{c.titulo}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                      {c._count?.documentos ?? 0}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {casos.filter((c) => (c._count?.documentos ?? 0) === 0).length > 0 && (
            <p className="text-xs text-gray-400 mt-3 px-1">
              {casos.filter((c) => (c._count?.documentos ?? 0) === 0).length} casos activos sin documentos.
              Los documentos se gestionan desde el detalle de cada caso.
            </p>
          )}
        </div>

        {/* Info note */}
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <FileText className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            Para ver, descargar o gestionar documentos de un caso específico, abre el caso y navega a la pestaña <span className="font-semibold">Documentos</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── UPLOAD PANEL ─────────────────────────────────────────────────────────────

function UploadPanel({ onClose, onSuccess }) {
  const fileInputRef = useRef(null);
  const [casoId, setCasoId] = useState('');
  const [file, setFile] = useState(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [confidencial, setConfidencial] = useState(false);
  const [dragging, setDragging] = useState(false);

  const { data: casosResp } = useQuery({
    queryKey: ['casos-select'],
    queryFn: () => getCasos({ porPagina: 100, estado: 'ACTIVO' }),
  });
  const casos = casosResp?.datos ?? [];

  const mutation = useMutation({
    mutationFn: () => subirDocumento(casoId, file, { nombre: nombre || file.name, tipo, descripcion, confidencial }),
    onSuccess: () => {
      toast.success('Documento subido exitosamente');
      onSuccess();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al subir el documento'),
  });

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) { setFile(dropped); if (!nombre) setNombre(dropped.name); }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); if (!nombre) setNombre(f.name); }
  };

  const canSubmit = casoId && file && !mutation.isPending;

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <Upload className="w-4 h-4 text-indigo-600" /> Subir documento
        </h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          {/* Case selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Caso <span className="text-red-500">*</span>
            </label>
            <select
              value={casoId}
              onChange={(e) => setCasoId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Seleccionar caso activo...</option>
              {casos.map((c) => (
                <option key={c.id} value={c.id}>{c.numero} — {c.titulo}</option>
              ))}
            </select>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragging ? 'border-indigo-400 bg-indigo-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-indigo-300 hover:bg-gray-50'
            }`}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <Check className="w-5 h-5 text-green-600" />
                <div className="text-left">
                  <p className="text-sm font-medium text-green-700 truncate max-w-[200px]">{file.name}</p>
                  <p className="text-xs text-green-500">{formatBytes(file.size)}</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">Arrastra un archivo aquí</p>
                <p className="text-xs text-gray-400 mt-0.5">o haz clic para seleccionar · Máx. 25 MB</p>
              </>
            )}
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del documento</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Demanda principal v1.pdf"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Tipo de documento</label>
            <div className="grid grid-cols-4 gap-1.5">
              {TIPOS_DOC.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(tipo === t ? '' : t)}
                  className={`py-1.5 text-[10px] font-medium rounded-lg border transition-all ${
                    tipo === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {TIPOS_DOC_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Descripción breve del contenido..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setConfidencial((v) => !v)}
              className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${confidencial ? 'bg-orange-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${confidencial ? 'translate-x-5' : ''}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-orange-500" /> Confidencial
              </p>
              <p className="text-xs text-gray-400">Solo visible para SOCIO y ADMIN</p>
            </div>
          </label>
        </div>
      </div>

      <div className="px-5 pb-5 flex gap-3 justify-end">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
          Cancelar
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
        >
          {mutation.isPending ? (
            <><Spinner size="sm" /> Subiendo...</>
          ) : (
            <><Upload className="w-4 h-4" /> Subir documento</>
          )}
        </button>
      </div>
    </div>
  );
}
