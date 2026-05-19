import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { getPlanes, activarSuscripcion } from '../../api/paypal';
import { useAuth } from '../../contexts/AuthContext';
import { Check } from 'lucide-react';

const FEATURES = {
  SOLO:       ['1 abogado', '50 casos activos', 'Todos los módulos', 'Soporte por email'],
  FIRMA:      ['Hasta 5 abogados', 'Casos ilimitados', 'Todos los módulos', 'Soporte prioritario'],
  ENTERPRISE: ['Abogados ilimitados', 'Multi-oficina', 'Todos los módulos', 'Soporte dedicado'],
};

function PlanCard({ plan, seleccionado, onSeleccionar }) {
  const esPopular = plan.nombre === 'FIRMA';
  return (
    <div
      onClick={() => onSeleccionar(plan.nombre)}
      className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all ${
        seleccionado
          ? 'border-indigo-500 bg-indigo-950/40'
          : 'border-gray-700 bg-gray-900 hover:border-gray-500'
      }`}
    >
      {esPopular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
          Más popular
        </span>
      )}
      <div className="mb-4">
        <p className="text-sm font-semibold text-indigo-400 uppercase tracking-wider">{plan.label}</p>
        <p className="mt-1">
          <span className="text-3xl font-bold text-white">B/.{plan.precio}</span>
          <span className="text-gray-400 text-sm">/mes</span>
        </p>
      </div>
      <ul className="space-y-2">
        {FEATURES[plan.nombre].map((f) => (
          <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
            <Check className="w-4 h-4 text-indigo-400 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SuscripcionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [planes, setPlanes] = useState([]);
  const [planSeleccionado, setPlanSeleccionado] = useState('FIRMA');
  const [exito, setExito] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlanes().then((p) => {
      setPlanes(p);
      setLoading(false);
    });
  }, []);

  const planActual = planes.find((p) => p.nombre === planSeleccionado);
  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;

  const handleApprove = async (data) => {
    setError('');
    try {
      await activarSuscripcion(data.subscriptionID);
      setExito(true);
      setTimeout(() => navigate('/dashboard'), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al activar la suscripción. Contacta soporte.');
    }
  };

  if (exito) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center p-4">
        <div>
          <div className="w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">¡Suscripción activada!</h2>
          <p className="text-gray-400">Redirigiendo al sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">GESTARLEX</h1>
        {user && (
          <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-400 hover:text-white">
            Volver al sistema
          </button>
        )}
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-3">Elige tu plan</h2>
          <p className="text-gray-400">Gestión legal profesional para firmas panameñas. Cancela cuando quieras.</p>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-12">Cargando planes...</div>
        ) : (
          <>
            {/* Selección de plan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              {planes.map((plan) => (
                <PlanCard
                  key={plan.nombre}
                  plan={plan}
                  seleccionado={planSeleccionado === plan.nombre}
                  onSeleccionar={setPlanSeleccionado}
                />
              ))}
            </div>

            {/* Botón PayPal */}
            {planActual?.paypalPlanId ? (
              <div className="max-w-sm mx-auto">
                <p className="text-center text-sm text-gray-400 mb-4">
                  Plan seleccionado: <span className="text-white font-medium">{planActual.label}</span> — B/.{planActual.precio}/mes
                </p>

                {clientId ? (
                  <PayPalScriptProvider
                    options={{
                      clientId,
                      vault: true,
                      intent: 'subscription',
                    }}
                  >
                    <PayPalButtons
                      style={{ layout: 'vertical', color: 'blue', shape: 'rect', label: 'subscribe' }}
                      createSubscription={(_data, actions) =>
                        actions.subscription.create({ plan_id: planActual.paypalPlanId })
                      }
                      onApprove={handleApprove}
                      onError={(err) => setError('Error en el proceso de pago. Intenta nuevamente.')}
                    />
                  </PayPalScriptProvider>
                ) : (
                  <div className="bg-yellow-950 border border-yellow-700 rounded-xl p-4 text-sm text-yellow-300 text-center">
                    Configura <code>VITE_PAYPAL_CLIENT_ID</code> para activar los pagos.
                  </div>
                )}

                {error && (
                  <p className="mt-4 text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-center">
                    {error}
                  </p>
                )}
              </div>
            ) : (
              <div className="max-w-sm mx-auto bg-gray-900 border border-gray-700 rounded-xl p-6 text-center text-sm text-gray-400">
                Este plan aún no está disponible para pago en línea.
                <br />Contacta a <a href="mailto:soporte@gestarsoft.com" className="text-indigo-400 underline">soporte@gestarsoft.com</a>
              </div>
            )}

            <p className="text-center text-xs text-gray-600 mt-8">
              Pagos procesados de forma segura por PayPal · Cancela en cualquier momento
            </p>
          </>
        )}
      </main>
    </div>
  );
}
