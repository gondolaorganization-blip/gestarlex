import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getClientes } from '../../api/clientes';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import { Search, Plus, Users, User, Building2 } from 'lucide-react';

export default function ClientesPage() {
  const [filtros, setFiltros] = useState({ busqueda: '', tipo: '', pagina: 1, porPagina: 20 });

  const { data, isLoading } = useQuery({
    queryKey: ['clientes', filtros],
    queryFn: () => getClientes(filtros),
    keepPreviousData: true,
  });

  const clientes = data?.datos ?? [];
  const paginacion = data?.paginacion;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {paginacion ? `${paginacion.total} cliente${paginacion.total !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <Link
          to="/clientes/nuevo"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo cliente
        </Link>
      </div>

      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, cédula, RUC..."
            value={filtros.busqueda}
            onChange={(e) => setFiltros({ ...filtros, busqueda: e.target.value, pagina: 1 })}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filtros.tipo}
          onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value, pagina: 1 })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos</option>
          <option value="PERSONA_NATURAL">Persona Natural</option>
          <option value="JURIDICA">Jurídica</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Spinner size="lg" /></div>
      ) : clientes.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No se encontraron clientes</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientes.map((c) => (
            <Link key={c.id} to={`/clientes/${c.id}`} className="block">
              <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-indigo-200 transition-all">
                <div className="flex items-start gap-3">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${c.tipo === 'JURIDICA' ? 'bg-indigo-100 text-indigo-600' : 'bg-green-100 text-green-600'}`}>
                    {c.tipo === 'JURIDICA' ? <Building2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <p className="font-semibold text-gray-800 truncate">{c.nombre}</p>
                    <Badge value={c.tipo} className="mt-1" />
                    {c.cedula && <p className="text-xs text-gray-400 mt-1">Cédula: {c.cedula}</p>}
                    {c.ruc && <p className="text-xs text-gray-400 mt-1">RUC: {c.ruc}</p>}
                    {c.email && <p className="text-xs text-gray-400 truncate">{c.email}</p>}
                  </div>
                </div>
                {c._count?.casos !== undefined && (
                  <p className="text-xs text-gray-400 mt-3 pt-3 border-t">
                    {c._count.casos} caso{c._count.casos !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
