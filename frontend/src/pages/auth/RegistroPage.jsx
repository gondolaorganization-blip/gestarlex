import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { registro as apiRegistro } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import Spinner from '../../components/ui/Spinner';

const PLANES = { solo: 'Solo', firma: 'Firma', enterprise: 'Enterprise' };

export default function RegistroPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get('plan');

  const [form, setForm] = useState({
    nombreFirma: '', ruc: '', nombreAbogado: '', numeroIdoneidad: '', email: '', password: '', confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden');

    setLoading(true);
    try {
      const datos = await apiRegistro({
        nombreFirma: form.nombreFirma.trim(),
        ruc: form.ruc.trim(),
        nombreAbogado: form.nombreAbogado.trim(),
        numeroIdoneidad: form.numeroIdoneidad.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      localStorage.setItem('accessToken', datos.accessToken);
      localStorage.setItem('refreshToken', datos.refreshToken);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Error al crear la cuenta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4">
            <Scale className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">GESTARLEX</h1>
          <p className="text-sm text-gray-500 mt-1">
            Crea tu cuenta — 14 días gratis, sin tarjeta de crédito
          </p>
          {planParam && PLANES[planParam] && (
            <span className="inline-block mt-2 text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full">
              Plan seleccionado: {PLANES[planParam]}
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-base font-semibold text-gray-700 mb-6">Datos de tu firma</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la firma *</label>
                <input type="text" required value={form.nombreFirma} onChange={set('nombreFirma')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej. Rodríguez & Asociados" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">RUC de la firma *</label>
                <input type="text" required value={form.ruc} onChange={set('ruc')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="8-123-456789 DV 51" />
              </div>
            </div>

            <hr className="border-gray-100 my-2" />
            <h2 className="text-base font-semibold text-gray-700">Tu información como abogado</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
              <input type="text" required value={form.nombreAbogado} onChange={set('nombreAbogado')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ana Rodríguez" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número de idoneidad *</label>
              <input type="text" required value={form.numeroIdoneidad} onChange={set('numeroIdoneidad')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ej. 12345-A" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
              <input type="email" required value={form.email} onChange={set('email')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="ana@firma.com.pa" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña *</label>
                <input type="password" required value={form.password} onChange={set('password')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="••••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar *</label>
                <input type="password" required value={form.confirm} onChange={set('confirm')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="••••••••" />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
              {loading ? <Spinner size="sm" /> : 'Crear cuenta y entrar →'}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Al registrarte aceptas nuestros{' '}
              <a href="https://gestarsoft.com/terminos" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">Términos</a>
              {' '}y{' '}
              <a href="https://gestarsoft.com/privacidad" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">Privacidad</a>.
            </p>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-indigo-600 font-medium hover:underline">Iniciar sesión →</Link>
        </p>
      </div>
    </div>
  );
}
