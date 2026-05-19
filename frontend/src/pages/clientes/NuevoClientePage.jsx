import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { crearCliente } from '../../api/clientes';
import { ArrowLeft, User, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NuevoClientePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    nombre: '',
    tipo: 'PERSONA_NATURAL',
    cedula: '',
    ruc: '',
    email: '',
    telefono: '',
    origen: '',
    notas: '',
  });

  const mutation = useMutation({
    mutationFn: crearCliente,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente creado exitosamente');
      navigate(`/clientes/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Error al crear el cliente');
    },
  });

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      nombre: form.nombre,
      tipo: form.tipo,
    };
    if (form.tipo === 'PERSONA_NATURAL' && form.cedula) payload.cedula = form.cedula;
    if (form.tipo === 'JURIDICA' && form.ruc) payload.ruc = form.ruc;
    if (form.email) payload.email = form.email;
    if (form.telefono) payload.telefono = form.telefono;
    if (form.origen) payload.origen = form.origen;
    if (form.notas) payload.notas = form.notas;
    mutation.mutate(payload);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <button onClick={() => navigate('/clientes')} className="flex items-center gap-1 hover:text-gray-700">
              <ArrowLeft className="w-3.5 h-3.5" /> Clientes
            </button>
            <span>/</span>
            <span className="text-gray-700 font-medium">Nuevo cliente</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-2">Agregar cliente</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Tipo */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Tipo de cliente</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'PERSONA_NATURAL', label: 'Persona Natural', Icon: User, color: 'green' },
                { value: 'JURIDICA', label: 'Persona Jurídica', Icon: Building2, color: 'indigo' },
              ].map(({ value, label, Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => set('tipo', value)}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    form.tipo === value
                      ? color === 'green'
                        ? 'border-green-500 bg-green-50'
                        : 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${
                    form.tipo === value
                      ? color === 'green' ? 'text-green-600' : 'text-indigo-600'
                      : 'text-gray-400'
                  }`} />
                  <span className={`text-sm font-medium ${
                    form.tipo === value
                      ? color === 'green' ? 'text-green-700' : 'text-indigo-700'
                      : 'text-gray-600'
                  }`}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Datos principales */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Datos principales</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {form.tipo === 'JURIDICA' ? 'Razón social' : 'Nombre completo'}{' '}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={form.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                  placeholder={form.tipo === 'JURIDICA' ? 'Ej: Constructora Panamá S.A.' : 'Ej: Juan Carlos Díaz'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              {form.tipo === 'PERSONA_NATURAL' ? (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cédula de identidad</label>
                  <input
                    value={form.cedula}
                    onChange={(e) => set('cedula', e.target.value)}
                    placeholder="Ej: 8-123-456"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">RUC</label>
                  <input
                    value={form.ruc}
                    onChange={(e) => set('ruc', e.target.value)}
                    placeholder="Ej: 2-01234-56-2023"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Contacto */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Información de contacto</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                <input
                  value={form.telefono}
                  onChange={(e) => set('telefono', e.target.value)}
                  placeholder="Ej: 6000-0000"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Origen / Referido por</label>
                <input
                  value={form.origen}
                  onChange={(e) => set('origen', e.target.value)}
                  placeholder="Ej: Referido por Juan Pérez, búsqueda en Google, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Notas */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Notas internas</h2>
            <textarea
              value={form.notas}
              onChange={(e) => set('notas', e.target.value)}
              rows={3}
              placeholder="Observaciones internas sobre este cliente..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pb-6">
            <button
              type="button"
              onClick={() => navigate('/clientes')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Guardando...' : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
