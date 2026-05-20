import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import CasosPage from './pages/casos/CasosPage';
import CasoDetailPage from './pages/casos/CasoDetailPage';
import ClientesPage from './pages/clientes/ClientesPage';
import ClienteDetailPage from './pages/clientes/ClienteDetailPage';
import NuevoClientePage from './pages/clientes/NuevoClientePage';
import NuevoCasoPage from './pages/casos/NuevoCasoPage';
import CalendarioPage from './pages/calendario/CalendarioPage';
import PoderesPage from './pages/poderes/PoderesPage';
import TimerPage from './pages/timer/TimerPage';
import FacturasPage from './pages/facturas/FacturasPage';
import FacturaDetallePage from './pages/facturas/FacturaDetallePage';
import DocumentosPage from './pages/documentos/DocumentosPage';
import AbogadosPage from './pages/abogados/AbogadosPage';
import ReportesPage from './pages/reportes/ReportesPage';
import CotizadorPage from './pages/cotizador/CotizadorPage';
import PlantillasPage from './pages/plantillas/PlantillasPage';
import PerfilPage from './pages/perfil/PerfilPage';
import AsistentePage from './pages/asistente/AsistentePage';
import PlaceholderPage from './pages/PlaceholderPage';
import LandingPage from './pages/LandingPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminFirmasPage from './pages/admin/AdminFirmasPage';
import SuscripcionPage from './pages/suscripcion/SuscripcionPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AuthProvider>
          <Toaster position="top-right" />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/casos" element={<CasosPage />} />
              <Route path="/casos/nuevo" element={<NuevoCasoPage />} />
              <Route path="/casos/:id" element={<CasoDetailPage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/clientes/nuevo" element={<NuevoClientePage />} />
              <Route path="/clientes/:id" element={<ClienteDetailPage />} />
              <Route path="/calendario" element={<CalendarioPage />} />
              <Route path="/documentos" element={<DocumentosPage />} />
              <Route path="/poderes" element={<PoderesPage />} />
              <Route path="/timer" element={<TimerPage />} />
              <Route path="/facturas" element={<FacturasPage />} />
              <Route path="/facturas/:id" element={<FacturaDetallePage />} />
              <Route path="/equipo" element={<AbogadosPage />} />
              <Route path="/reportes" element={<ReportesPage />} />
              <Route path="/cotizador" element={<CotizadorPage />} />
              <Route path="/plantillas" element={<PlantillasPage />} />
              <Route path="/perfil" element={<PerfilPage />} />
              <Route path="/asistente" element={<AsistentePage />} />
            </Route>
            <Route path="/suscripcion" element={<SuscripcionPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
            {/* Panel super admin — token independiente, sin AppLayout */}
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<AdminFirmasPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
