import { useQuery } from '@tanstack/react-query';
import { getDocumentosCaso } from '../../../api/documentos';
import api from '../../../api/client';
import Spinner from '../../../components/ui/Spinner';
import { FileText, Lock, Download, FileImage, FileArchive, File } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const formatBytes = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const tipoIcono = (mime) => {
  if (!mime) return File;
  if (mime.includes('image')) return FileImage;
  if (mime.includes('zip') || mime.includes('rar')) return FileArchive;
  return FileText;
};

const descargar = async (id, nombre) => {
  const res = await api.get(`/documentos/${id}/descargar`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
};

const tipoColor = (tipo) => {
  const map = {
    demanda: 'bg-red-50 text-red-700',
    sentencia: 'bg-purple-50 text-purple-700',
    poder: 'bg-indigo-50 text-indigo-700',
    resolución: 'bg-blue-50 text-blue-700',
    contestación: 'bg-orange-50 text-orange-700',
  };
  return map[tipo?.toLowerCase()] ?? 'bg-gray-50 text-gray-600';
};

export default function TabDocumentos({ casoId }) {
  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['documentos', casoId],
    queryFn: () => getDocumentosCaso(casoId),
  });

  if (isLoading) return <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>;

  if (documentos.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Sin documentos adjuntos</p>
        <p className="text-sm mt-1">Los documentos del expediente aparecerán aquí</p>
      </div>
    );
  }

  // Agrupar por tipo
  const porTipo = documentos.reduce((acc, d) => {
    const tipo = d.tipo || 'Otros';
    if (!acc[tipo]) acc[tipo] = [];
    acc[tipo].push(d);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-4xl">
      {Object.entries(porTipo).map(([tipo, docs]) => (
        <section key={tipo}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs ${tipoColor(tipo)}`}>
              {tipo}
            </span>
            <span>({docs.length})</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {docs.map((d) => {
              const Icon = tipoIcono(d.mimeType);
              return (
                <div key={d.id} className="flex items-start gap-3 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-center w-10 h-10 bg-indigo-50 rounded-lg shrink-0">
                    <Icon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-800 truncate">{d.nombre}</p>
                      {d.confidencial && (
                        <Lock className="w-3 h-3 text-red-400 shrink-0" title="Confidencial" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-gray-400">v{d.version}</span>
                      {d.tamanoBytes && (
                        <span className="text-xs text-gray-400">{formatBytes(d.tamanoBytes)}</span>
                      )}
                      {d.subidoPor && (
                        <span className="text-xs text-gray-400">por {d.subidoPor.nombre}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {format(parseISO(d.fechaSubida), "d MMM yyyy HH:mm", { locale: es })}
                    </p>
                  </div>
                  <button
                    onClick={() => descargar(d.id, d.nombre)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors shrink-0"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
