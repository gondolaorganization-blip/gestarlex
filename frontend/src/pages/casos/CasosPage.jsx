import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getCasos } from '../../api/casos';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { Search, Plus, FolderOpen, User, Building2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const TIPOS_CASO = ['CIVIL', 'PENAL', 'LABORAL', 'COMERCIAL', 'ADMINISTRATIVO', 'FAMILIAR', 'MARITIMO'];

export default function CasosPage() {
  const [filtros, setFiltros] = useState({
    busqueda: '', estado: '', tipo: '', pagina: 1, porPagina: 20,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['casos', filtros],
    queryFn: () => getCasos(filtros),
    keepPreviousData: true,
  });

  const casos = data?.datos ?? [];
  const paginacion = data?.paginacion;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Casos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {paginacion ? `${paginacion.total} expediente${paginacion.total !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <Link
          to="/casos/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo caso
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por expediente, título, contraparte..."
            value={filtros.busqueda}
            onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value, pagina: 1 })}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filtros.estado}
          onChange={(e) => setFiltros({ ...filtros, estado: e.target.value, pagina: 1 })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="SUSPENDIDO">Suspendido</option>
          <option value="CERRADO">Cerrado</option>
          <option value="ARCHIVADO">Archivado</option>
        </select>
        <select
          value={filtros.tipo}
          onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value, pagina: 1 })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los tipos</option>
          {TIPOS_CASO.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" />
        </div>
      ) : casos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No se encontraron casos</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Expediente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Título</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Abogado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Apertura</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {casos.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                      {c.numero}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-medium text-gray-800 truncate">{c.titulo}</p>
                    {c.juzgado && <p className="text-xs text-gray-400 truncate">{c.juzgado}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {c.cliente.tipo === 'JURIDICA'
                        ? <Building2 className="w-3 h-3 text-gray-400 shrink-0" />
                        : <User className="w-3 h-3 text-gray-400 shrink-0" />
                      }
                      <span className="truncate max-w-32">{c.cliente.nombre}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-32 truncate">{c.abogado.nombre}</td>
                  <td className="px-4 py-3"><Badge value={c.tipo} /></td>
                  <td className="px-4 py-3"><Badge value={c.estado} /></td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {format(parseISO(c.fechaApertura), 'd MMM yyyy', { locale: es })}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/casos/${c.id}`}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-xs"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginación */}
          {paginacion && paginacion.totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">
                Página {paginacion.pagina} de {paginacion.totalPaginas} · {paginacion.total} total
              </p>
              <div className="flex gap-2">
                <button
                  disabled={paginacion.pagina <= 1}
                  onClick={() => setFiltros({ ...filtros, pagina: filtros.pagina - 1 })}
                  className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  disabled={paginacion.pagina >= paginacion.totalPaginas}
                  onClick={() => setFiltros({ ...filtros, pagina: filtros.pagina + 1 })}
                  className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
