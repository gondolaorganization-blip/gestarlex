import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { crearFactura } from '../../api/facturas';
import { getClientes } from '../../api/clientes';
import { enviarCotizacion } from '../../api/comunicaciones';
import {
  Calculator, Plus, Trash2, Printer, BookOpen,
  X, Save, Info, Star, List, ChevronDown, ChevronRight, Send, Mail,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── TARIFAS OFICIALES — ACUERDO 49/2001 ─────────────────────────────────────

const TARIFAS_ACUERDO_49 = [
  {
    categoria: 'Derecho de Familia',
    items: [
      { label: 'Divorcio / Nulidad de Matrimonio',           tipo: 'RANGO',      min: 500,  max: 2000 },
      { label: 'Guarda, Crianza y Educación',                tipo: 'FIJO',       monto: 1000 },
      { label: 'Reglamentación de Visitas',                  tipo: 'FIJO',       monto: 500  },
      { label: 'Alimentos (2da instancia)',                  tipo: 'FIJO',       monto: 300  },
      { label: 'Filiación',                                  tipo: 'FIJO',       monto: 1000 },
      { label: 'Adopción',                                   tipo: 'FIJO',       monto: 1000 },
      { label: 'Impugnación de Paternidad',                  tipo: 'FIJO',       monto: 1000 },
      { label: 'Reconocimientos Voluntarios',                tipo: 'FIJO',       monto: 300  },
      { label: 'Emancipación',                               tipo: 'FIJO',       monto: 500  },
      { label: 'Matrimonios de Hecho',                       tipo: 'FIJO',       monto: 1000 },
      { label: 'Disolución y Liquidación Régimen Económico', tipo: 'FIJO',       monto: 500, nota: '+ 20% del activo neto' },
      { label: 'Otros procesos de familia',                  tipo: 'FIJO',       monto: 500  },
      { label: 'Interdicción o Rehabilitación',              tipo: 'FIJO',       monto: 1000 },
      { label: 'Violencia Intrafamiliar',                    tipo: 'FIJO',       monto: 500  },
      { label: 'Impedimentos de salida de menores',          tipo: 'FIJO',       monto: 300  },
      { label: 'Permisos de salida de menores',              tipo: 'FIJO',       monto: 300  },
      { label: 'Pensiones Prenatales',                       tipo: 'FIJO',       monto: 300  },
    ],
  },
  {
    categoria: 'Migración',
    items: [
      { label: 'Visitantes Temporales (por persona)',        tipo: 'FIJO', monto: 500  },
      { label: 'Prórroga Visitante Temporal',               tipo: 'FIJO', monto: 300  },
      { label: 'Casado con nacional panameño',              tipo: 'FIJO', monto: 800  },
      { label: 'Inversionista (1er año)',                   tipo: 'FIJO', monto: 1000 },
      { label: 'Inversionista (2do año)',                   tipo: 'FIJO', monto: 800  },
      { label: 'Naturalizaciones',                          tipo: 'FIJO', monto: 2000 },
      { label: 'Visa de Estudiantes',                       tipo: 'FIJO', monto: 400  },
      { label: 'Visa de Religiosos',                        tipo: 'FIJO', monto: 400  },
      { label: 'Visa de Visitante Familiar',                tipo: 'FIJO', monto: 500  },
      { label: 'Permisos Especiales',                       tipo: 'FIJO', monto: 1000 },
      { label: 'Salvo Conductos',                           tipo: 'FIJO', monto: 500  },
      { label: 'Permiso simple salida/regreso',             tipo: 'FIJO', monto: 250  },
      { label: 'Visa salida y regreso múltiple',            tipo: 'FIJO', monto: 350  },
      { label: 'Visa Turista Pensionado',                   tipo: 'FIJO', monto: 1500 },
      { label: 'Visa de Rentista',                          tipo: 'FIJO', monto: 1500 },
      { label: 'Visa ejecutivo Zona Libre',                 tipo: 'FIJO', monto: 750  },
      { label: 'Visa bajo resolución Min. de Trabajo',      tipo: 'FIJO', monto: 750  },
      { label: 'Recurso de Reconsideración',                tipo: 'FIJO', monto: 250  },
      { label: 'Recurso de Apelación (Migración)',          tipo: 'FIJO', monto: 500  },
      { label: 'Por cada dependiente adicional',            tipo: 'FIJO', monto: 200  },
    ],
  },
  {
    categoria: 'Derecho Comercial / Sociedades',
    items: [
      { label: 'Constitución Sociedad Anónima',             tipo: 'FIJO', monto: 500  },
      { label: 'Constitución Soc. de Resp. Limitada',       tipo: 'FIJO', monto: 500  },
      { label: 'Fundación de Interés Privado',              tipo: 'FIJO', monto: 1000 },
      { label: 'Confección de estatutos',                   tipo: 'FIJO', monto: 500  },
      { label: 'Confección de Actas',                       tipo: 'FIJO', monto: 250  },
      { label: 'Confección de Poderes de sociedades',       tipo: 'FIJO', monto: 250  },
      { label: 'Disolución de Sociedades',                  tipo: 'FIJO', monto: 500  },
      { label: 'Agente Residente (al año)',                 tipo: 'FIJO', monto: 200  },
      { label: 'Actuación como Director SA (al año)',       tipo: 'FIJO', monto: 300  },
      { label: 'Consulta verbal',                           tipo: 'FIJO', monto: 100  },
      { label: 'Consulta o concepto escrito',               tipo: 'FIJO', monto: 250  },
      { label: 'Tarifa por hora (Derecho Comercial)',       tipo: 'HORA', monto: 150  },
    ],
  },
  {
    categoria: 'Derecho Laboral',
    items: [
      { label: 'Permiso de trabajo (obtención o prórroga)', tipo: 'FIJO',       monto: 400  },
      { label: 'Elaboración Contrato de Trabajo',           tipo: 'FIJO',       monto: 200  },
      { label: 'Reglamento Interno (elaboración)',          tipo: 'FIJO',       monto: 600  },
      { label: 'Reglamento Interno (trámite aprobación)',   tipo: 'FIJO',       monto: 400  },
      { label: 'Conciliación mutuo acuerdo',                tipo: 'FIJO',       monto: 250  },
      { label: 'Proceso conocimiento empleador (1ra inst.)',tipo: 'FIJO',       monto: 750  },
      { label: 'Proceso conocimiento empleador (2da inst.)',tipo: 'FIJO',       monto: 500  },
      { label: 'Proceso ejecutivo laboral (demandante)',    tipo: 'PORCENTAJE', porcentaje: 25, descripcion: '25% de lo obtenido' },
      { label: 'Tarifa por hora (trabajador)',              tipo: 'HORA',       monto: 50   },
      { label: 'Tarifa por hora (empleador)',               tipo: 'HORA',       monto: 150  },
    ],
  },
  {
    categoria: 'Derecho Procesal Civil',
    items: [
      { label: 'Proceso Ejecutivo — menor cuantía',         tipo: 'PORCENTAJE', porcentaje: 25, descripcion: '25% del monto' },
      { label: 'Proceso Ejecutivo — hasta B/.2,000',        tipo: 'PORCENTAJE', porcentaje: 20, descripcion: '20% del monto' },
      { label: 'Proceso Ejecutivo — B/.2,000–B/.10,000',    tipo: 'PORCENTAJE', porcentaje: 15, descripcion: '15% del monto' },
      { label: 'Proceso Ejecutivo — B/.10,000–B/.100,000',  tipo: 'PORCENTAJE', porcentaje: 10, descripcion: '10% del monto' },
      { label: 'Proceso Ordinario — menor cuantía / hasta B/.20,000', tipo: 'PORCENTAJE', porcentaje: 25, descripcion: '25% del monto' },
      { label: 'Proceso Ordinario — B/.20,000–B/.100,000',  tipo: 'PORCENTAJE', porcentaje: 20, descripcion: '20% del monto' },
      { label: 'Proceso Sucesorio — hasta B/.50,000',       tipo: 'PORCENTAJE', porcentaje: 15, descripcion: '15% sobre el activo' },
      { label: 'Proceso Sucesorio — más de B/.50,000',      tipo: 'PORCENTAJE', porcentaje: 10, descripcion: '10% sobre el activo líquido' },
      { label: 'Desahucio y Lanzamiento ante Tribunales',   tipo: 'FIJO',       monto: 5000 },
      { label: 'Casación — hasta B/.50,000',                tipo: 'FIJO',       monto: 3000 },
      { label: 'Casación — más de B/.50,000',               tipo: 'FIJO',       monto: 5000 },
      { label: 'Amparo de Garantías (Circuito)',             tipo: 'FIJO',       monto: 1000 },
      { label: 'Amparo de Garantías (Corte Suprema)',        tipo: 'FIJO',       monto: 3000 },
      { label: 'Habeas Corpus',                             tipo: 'FIJO',       monto: 1000 },
    ],
  },
  {
    categoria: 'Derecho Penal / Criminal',
    items: [
      { label: 'Consulta verbal',                                       tipo: 'RANGO', min: 100, max: 300 },
      { label: 'Consulta escrita',                                      tipo: 'FIJO',  monto: 300  },
      { label: 'Asistencia al detenido (act. policiales)',              tipo: 'FIJO',  monto: 300  },
      { label: 'Asistencia en indagatoria',                             tipo: 'FIJO',  monto: 300  },
      { label: 'Formalización de denuncia (Fiscalía de Circuito)',      tipo: 'FIJO',  monto: 1000 },
      { label: 'Defensa en esfera Municipal',                           tipo: 'FIJO',  monto: 1500 },
      { label: 'Defensa en esfera de Circuito',                         tipo: 'FIJO',  monto: 2500 },
      { label: 'Defensa en esferas Superiores',                         tipo: 'FIJO',  monto: 3500 },
      { label: 'Defensa ante autoridades de jurisdicción nacional',     tipo: 'FIJO',  monto: 4500 },
    ],
  },
  {
    categoria: 'Documentos y Trámites Notariales',
    items: [
      { label: 'Poder por persona natural',                 tipo: 'FIJO', monto: 100  },
      { label: 'Poder por persona jurídica',                tipo: 'FIJO', monto: 200  },
      { label: 'Minuta — hasta B/.3,000',                   tipo: 'FIJO', monto: 200  },
      { label: 'Minuta — B/.3,001–B/.5,000',               tipo: 'FIJO', monto: 250  },
      { label: 'Minuta — B/.5,001–B/.10,000',              tipo: 'FIJO', monto: 275  },
      { label: 'Minuta — B/.10,001–B/.30,000',             tipo: 'FIJO', monto: 400  },
      { label: 'Minuta — B/.30,001–B/.50,000',             tipo: 'FIJO', monto: 500  },
      { label: 'Minuta — B/.50,001–B/.100,000',            tipo: 'FIJO', monto: 800  },
      { label: 'Minuta — B/.100,001–B/.150,000',           tipo: 'FIJO', monto: 1500 },
      { label: 'Contrato arrendamiento habitacional',       tipo: 'FIJO', monto: 50   },
      { label: 'Contrato arrendamiento comercial',          tipo: 'FIJO', monto: 100  },
      { label: 'Registro Propiedad Industrial (Marca)',     tipo: 'FIJO', monto: 500  },
      { label: 'Registro Propiedad Intelectual / Der. Autor', tipo: 'FIJO', monto: 500 },
    ],
  },
  {
    categoria: 'Derecho Administrativo / MICI',
    items: [
      { label: 'Obtención Licencia Comercial',                       tipo: 'FIJO', monto: 400 },
      { label: 'Modificación/Cancelación Licencia Comercial',        tipo: 'FIJO', monto: 250 },
      { label: 'Obtención Registro Comercial',                       tipo: 'FIJO', monto: 300 },
      { label: 'Licencia corredor bienes raíces (persona jurídica)', tipo: 'FIJO', monto: 750 },
      { label: 'Licencia corredor bienes raíces (persona natural)',  tipo: 'FIJO', monto: 300 },
      { label: 'Personería Jurídica (asoc. sin fines de lucro)',     tipo: 'FIJO', monto: 500 },
      { label: 'Consultas y asesoría por hora',                      tipo: 'HORA', monto: 150 },
    ],
  },
];

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const LS_KEY = 'gestarlex_plantillas_custom';

const PLANTILLAS_BUILTIN = [
  {
    id: 'consulta-legal',
    nombre: 'Consultoría Legal',
    descripcion: 'Consulta inicial + investigación jurídica',
    servicios: [
      { descripcion: 'Consulta inicial y análisis del caso', tipo: 'HORA', cantidad: 1, tarifa: 150 },
      { descripcion: 'Investigación jurídica y dictamen', tipo: 'HORA', cantidad: 2, tarifa: 150 },
    ],
    gastos: [],
  },
  {
    id: 'divorcio',
    nombre: 'Divorcio de Mutuo Acuerdo',
    descripcion: 'Proceso consensual · Derecho de Familia',
    servicios: [
      { descripcion: 'Representación en proceso de divorcio de mutuo acuerdo', tipo: 'FIJO', cantidad: 1, tarifa: 800 },
      { descripcion: 'Preparación de acuerdo y documentación', tipo: 'HORA', cantidad: 3, tarifa: 150 },
    ],
    gastos: [
      { descripcion: 'Tasa judicial', monto: 30 },
      { descripcion: 'Notaría — protocolización', monto: 120 },
    ],
  },
  {
    id: 'sa-constitucion',
    nombre: 'Constitución de S.A.',
    descripcion: 'Sociedad Anónima · Derecho corporativo',
    servicios: [
      { descripcion: 'Elaboración de pacto social y estatutos', tipo: 'FIJO', cantidad: 1, tarifa: 600 },
      { descripcion: 'Trámites de registro y publicación', tipo: 'HORA', cantidad: 4, tarifa: 150 },
    ],
    gastos: [
      { descripcion: 'Notaría — protocolización del pacto social', monto: 200 },
      { descripcion: 'Registro Público de Panamá', monto: 75 },
      { descripcion: 'Aviso en Gaceta Oficial', monto: 40 },
    ],
  },
  {
    id: 'demanda-civil',
    nombre: 'Demanda Ordinaria Civil',
    descripcion: 'Tribunal de Circuito Civil · Ley 402/2023',
    servicios: [
      { descripcion: 'Análisis del caso y estrategia legal', tipo: 'HORA', cantidad: 3, tarifa: 150 },
      { descripcion: 'Elaboración de demanda y anexos', tipo: 'HORA', cantidad: 5, tarifa: 150 },
      { descripcion: 'Representación en audiencias (estimado)', tipo: 'HORA', cantidad: 8, tarifa: 150 },
    ],
    gastos: [
      { descripcion: 'Tasa judicial de radicación', monto: 50 },
      { descripcion: 'Notificaciones y diligencias', monto: 75 },
    ],
  },
  {
    id: 'proceso-laboral',
    nombre: 'Proceso Laboral',
    descripcion: 'Juzgado de Trabajo · Código de Trabajo',
    servicios: [
      { descripcion: 'Análisis de la situación laboral', tipo: 'HORA', cantidad: 2, tarifa: 150 },
      { descripcion: 'Elaboración de demanda laboral', tipo: 'HORA', cantidad: 4, tarifa: 150 },
      { descripcion: 'Representación en audiencias', tipo: 'HORA', cantidad: 6, tarifa: 150 },
    ],
    gastos: [
      { descripcion: 'Tasa de radicación', monto: 25 },
    ],
  },
  {
    id: 'recurso-apelacion',
    nombre: 'Recurso de Apelación',
    descripcion: 'Impugnación ante tribunal superior · Ley 402/2023',
    servicios: [
      { descripcion: 'Análisis de la resolución apelada', tipo: 'HORA', cantidad: 2, tarifa: 150 },
      { descripcion: 'Elaboración del recurso de apelación', tipo: 'HORA', cantidad: 4, tarifa: 150 },
      { descripcion: 'Representación en vista oral', tipo: 'HORA', cantidad: 2, tarifa: 150 },
    ],
    gastos: [],
  },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const uid  = () => Math.random().toString(36).slice(2, 9);

const fmtB = (n) =>
  `B/. ${Number(n || 0).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const todayStr = () => new Date().toISOString().split('T')[0];

const buildRef = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `COT-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

const newServicio = () => ({ id: uid(), descripcion: '', tipo: 'HORA', cantidad: 1, tarifa: 0 });
const newGasto    = () => ({ id: uid(), descripcion: '', monto: 0 });

const COT_INIT = () => ({
  cliente:          '',
  referencia:       buildRef(),
  fecha:            todayStr(),
  validezDias:      30,
  servicios:        [newServicio()],
  gastos:           [],
  ajustePorcentaje: 0,
  notas:            '',
});

// ─── HOOK: CUSTOM TEMPLATES ───────────────────────────────────────────────────

function usePlantillasCustom() {
  const [plantillas, setPlantillas] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
    catch { return []; }
  });

  const guardar = (p) => {
    const nueva = { ...p, id: uid() };
    const updated = [nueva, ...plantillas];
    setPlantillas(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  const eliminar = (id) => {
    const updated = plantillas.filter((p) => p.id !== id);
    setPlantillas(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
  };

  return { plantillas, guardar, eliminar };
}

// ─── PLANTILLAS PANEL ─────────────────────────────────────────────────────────

function PlantillasPanel({ custom, onLoad, onDelete, onClose }) {
  return (
    <div className="no-print fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-80 bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-indigo-500" /> Plantillas
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Incluidas</p>
            <div className="space-y-2">
              {PLANTILLAS_BUILTIN.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onLoad(p)}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 truncate">{p.nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.descripcion}</p>
                    </div>
                    <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full shrink-0 font-medium">
                      {p.servicios.length} serv.
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {custom.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Guardadas por ti</p>
              <div className="space-y-2">
                {custom.map((p) => (
                  <div key={p.id} className="flex items-start gap-2">
                    <button
                      onClick={() => onLoad(p)}
                      className="flex-1 text-left p-3 rounded-xl border border-amber-200 bg-amber-50 hover:border-amber-400 hover:bg-amber-100 transition-all"
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Star className="w-3 h-3 text-amber-500" />
                        <p className="text-sm font-semibold text-gray-800 truncate">{p.nombre}</p>
                      </div>
                      {p.descripcion && <p className="text-xs text-gray-500">{p.descripcion}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{p.servicios.length} serv. · {p.gastos.length} gastos</p>
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors mt-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {custom.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-3">
              Usa el botón "Guardar plantilla" para crear plantillas personalizadas
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TARIFAS PANEL ────────────────────────────────────────────────────────────

function TarifasPanel({ onAdd, onClose }) {
  const [openCats, setOpenCats] = useState(new Set());

  const toggleCat = (cat) => {
    setOpenCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const labelMonto = (item) => {
    if (item.tipo === 'FIJO' || item.tipo === 'HORA') return fmtB(item.monto);
    if (item.tipo === 'RANGO') return `B/.${item.min}–${item.max}`;
    return item.descripcion;
  };

  return (
    <div className="no-print fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-96 bg-white h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <List className="w-4 h-4 text-indigo-500" /> Tarifas Oficiales
            </h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Acuerdo No. 49 · 24 abr 2001 · Órgano Judicial</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-500 px-5 py-2.5 bg-amber-50 border-b border-amber-100 shrink-0">
          Haz clic en una tarifa para agregarla a la cotización.
        </p>

        <div className="flex-1 overflow-y-auto">
          {TARIFAS_ACUERDO_49.map((cat) => (
            <div key={cat.categoria} className="border-b border-gray-100 last:border-0">
              <button
                onClick={() => toggleCat(cat.categoria)}
                className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-xs font-bold text-gray-600 uppercase tracking-wide text-left">
                  {cat.categoria}
                </span>
                {openCats.has(cat.categoria)
                  ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                }
              </button>

              {openCats.has(cat.categoria) && (
                <div className="bg-white">
                  {cat.items.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => onAdd(item)}
                      className="w-full text-left flex items-center justify-between px-5 py-2.5 hover:bg-indigo-50 group border-t border-gray-50 transition-colors"
                    >
                      <span className="text-sm text-gray-700 group-hover:text-indigo-700 flex-1 pr-3 leading-tight">
                        {item.label}
                        {item.nota && <span className="text-[10px] text-gray-400 block">{item.nota}</span>}
                      </span>
                      <span className="text-xs font-semibold font-mono text-indigo-600 whitespace-nowrap shrink-0">
                        {labelMonto(item)}
                        {item.tipo === 'HORA' && <span className="text-gray-400 font-normal">/h</span>}
                        {item.tipo === 'PORCENTAJE' && <span className="text-[10px] text-gray-400 font-normal ml-1">%</span>}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-5 py-3 bg-gray-50 border-t shrink-0">
          <p className="text-[10px] text-gray-400 text-center">
            Los honorarios mínimos pueden ajustarse según complejidad del caso.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── TARIFA CALC MODAL (rangos y porcentajes) ─────────────────────────────────

function TarifaCalcModal({ tarifa, onAdd, onClose }) {
  const defaultVal = tarifa.tipo === 'RANGO'
    ? String(Math.round((tarifa.min + tarifa.max) / 2))
    : '';
  const [valor, setValor] = useState(defaultVal);

  const num = Number(valor) || 0;
  const honorario = tarifa.tipo === 'PORCENTAJE'
    ? num * tarifa.porcentaje / 100
    : num;

  const handleAdd = () => {
    if (honorario <= 0) return;
    onAdd({ tarifa: honorario, descripcion: tarifa.label });
    onClose();
  };

  return (
    <div className="no-print fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
        <h3 className="font-bold text-gray-900 mb-1">{tarifa.label}</h3>
        <p className="text-xs text-gray-500 mb-4">{tarifa.descripcion}</p>

        {tarifa.tipo === 'PORCENTAJE' ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Monto del proceso / lo obtenido (B/.)
              </label>
              <input
                autoFocus
                type="number"
                min="0"
                step="100"
                value={valor}
                onChange={e => setValor(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="0.00"
              />
            </div>
            <div className="bg-indigo-50 rounded-lg px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-indigo-700">
                {tarifa.porcentaje}% de {fmtB(num)}
              </span>
              <span className="text-lg font-bold text-indigo-700 font-mono">{fmtB(honorario)}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Honorario propuesto (B/.) <span className="text-gray-400">— rango B/.{tarifa.min}–B/.{tarifa.max}</span>
              </label>
              <input
                autoFocus
                type="number"
                min={tarifa.min}
                max={tarifa.max}
                step="50"
                value={valor}
                onChange={e => setValor(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>Mínimo: {fmtB(tarifa.min)}</span>
              <span>Máximo: {fmtB(tarifa.max)}</span>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleAdd}
            disabled={honorario <= 0}
            className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            Agregar {fmtB(honorario)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CONVERTIR A FACTURA MODAL ────────────────────────────────────────────────

function ConvertirFacturaModal({ cot, totales, onClose }) {
  const navigate = useNavigate();
  const [clienteId, setClienteId] = useState('');
  const [vence, setVence] = useState('');
  const [notas, setNotas] = useState(
    [`Cotización ${cot.referencia}`, cot.notas].filter(Boolean).join('\n')
  );

  const { data: clientesResp } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: () => getClientes({ porPagina: 200 }),
  });
  const clientes = clientesResp?.datos ?? [];

  const mutation = useMutation({
    mutationFn: () => crearFactura({
      clienteId,
      monto: totales.total,
      vence: vence || undefined,
      notas: notas || undefined,
    }),
    onSuccess: (factura) => {
      toast.success('Factura creada. Redirigiendo...');
      onClose();
      navigate(`/facturas/${factura.id}`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al crear la factura'),
  });

  return (
    <div className="no-print fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Convertir cotización a factura</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-indigo-50 rounded-xl px-4 py-3 mb-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-indigo-600 font-semibold">{cot.referencia}</p>
            <p className="text-xs text-indigo-400 mt-0.5">Total a facturar</p>
          </div>
          <p className="text-2xl font-black text-indigo-700 font-mono">{fmtB(totales.total)}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de vencimiento (opcional)</label>
            <input
              type="date"
              value={vence}
              onChange={e => setVence(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas (aparecen en la factura)</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!clienteId || mutation.isPending}
            className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {mutation.isPending ? 'Creando...' : 'Crear Factura'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ENVIAR COTIZACIÓN POR EMAIL ──────────────────────────────────────────────

function EnviarCotizacionModal({ cot, totales, onClose }) {
  const [modo, setModo] = useState('cliente'); // 'cliente' | 'manual'
  const [clienteId, setClienteId] = useState('');
  const [emailManual, setEmailManual] = useState('');
  const [nombreManual, setNombreManual] = useState('');
  const [notas, setNotas] = useState(cot.notas || '');

  const { data: clientesResp } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: () => getClientes({ porPagina: 200 }),
  });
  const clientes = clientesResp?.datos ?? [];
  const clienteSel = clientes.find(c => c.id === clienteId);

  const destinatario = modo === 'cliente' ? (clienteSel?.email ?? '') : emailManual;
  const destinatarioNombre = modo === 'cliente' ? (clienteSel?.nombre ?? '') : nombreManual;

  const mutation = useMutation({
    mutationFn: () => enviarCotizacion({
      destinatario,
      destinatarioNombre,
      referencia: cot.referencia,
      notas: notas || undefined,
      servicios: [
        ...cot.servicios.map(s => ({
          descripcion: s.descripcion,
          cantidad: Number(s.cantidad),
          tarifa: Number(s.tarifa),
        })),
        ...cot.gastos.map(g => ({
          descripcion: `[Gasto] ${g.descripcion}`,
          cantidad: 1,
          tarifa: Number(g.monto),
        })),
      ],
      totales: {
        subtotalH: totales.subtotalHonorarios,
        subtotalG: totales.subtotalGastos,
        ajuste: totales.montoAjuste,
        total: totales.total,
      },
    }),
    onSuccess: (data) => {
      if (data?.enviado === false) {
        toast.error(`No se pudo enviar: ${data.motivo ?? 'SMTP no configurado'}`);
      } else {
        toast.success('Cotización enviada por email');
        onClose();
      }
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al enviar'),
  });

  const canSend = destinatario.includes('@') && !mutation.isPending;

  return (
    <div className="no-print fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600" /> Enviar cotización por email
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resumen */}
        <div className="bg-indigo-50 rounded-xl px-4 py-3 mb-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-indigo-600 font-semibold">{cot.referencia || 'Sin referencia'}</p>
            <p className="text-xs text-indigo-400 mt-0.5">{cot.servicios.length + cot.gastos.length} ítem(s)</p>
          </div>
          <p className="text-2xl font-black text-indigo-700 font-mono">{fmtB(totales.total)}</p>
        </div>

        {/* Modo destinatario */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setModo('cliente')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${modo === 'cliente' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            Cliente del sistema
          </button>
          <button
            onClick={() => setModo('manual')}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${modo === 'manual' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
          >
            Email manual
          </button>
        </div>

        <div className="space-y-3">
          {modo === 'cliente' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cliente <span className="text-red-500">*</span></label>
                <select
                  value={clienteId}
                  onChange={e => setClienteId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}{c.email ? ` — ${c.email}` : ' (sin email)'}</option>
                  ))}
                </select>
              </div>
              {clienteSel && !clienteSel.email && (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  Este cliente no tiene email registrado. Selecciona otro o usa email manual.
                </p>
              )}
              {clienteSel?.email && (
                <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                  Se enviará a: <strong>{clienteSel.email}</strong>
                </p>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  value={emailManual}
                  onChange={e => setEmailManual(e.target.value)}
                  placeholder="destinatario@ejemplo.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del destinatario</label>
                <input
                  value={nombreManual}
                  onChange={e => setNombreManual(e.target.value)}
                  placeholder="Nombre completo (opcional)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mensaje adicional (opcional)</label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={3}
              placeholder="Nota o aclaración para el cliente..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!canSend}
            className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {mutation.isPending ? 'Enviando...' : 'Enviar cotización'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PRINT DOCUMENT ───────────────────────────────────────────────────────────

function PrintDoc({ cot, firma, totales }) {
  const { subtotalHonorarios, montoAjuste, totalHonorarios, subtotalGastos, total } = totales;
  const ajuste = Number(cot.ajustePorcentaje);
  const fechaFmt = cot.fecha
    ? new Date(cot.fecha + 'T12:00:00').toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div id="cotizador-print" className="print-show p-8 font-sans text-gray-900 max-w-[750px] mx-auto">
      <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-900">
        <div>
          <h1 className="text-xl font-black uppercase tracking-wide">{firma}</h1>
          <p className="text-xs text-gray-500 mt-0.5">República de Panamá</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">Referencia</p>
          <p className="font-bold text-gray-800 font-mono">{cot.referencia}</p>
          <p className="text-xs text-gray-500 mt-1">{fechaFmt}</p>
        </div>
      </div>

      <h2 className="text-center text-base font-bold uppercase tracking-widest text-gray-800 mb-6">
        Cotización de Honorarios Profesionales
      </h2>

      <div className="mb-6 p-3 bg-gray-50 rounded-lg">
        <div className="flex gap-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Cliente / Destinatario</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{cot.cliente || '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Válida hasta</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{cot.validezDias} días desde la fecha</p>
          </div>
        </div>
      </div>

      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">I. Honorarios Profesionales</p>
      <table className="w-full text-sm mb-1" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #374151' }}>
            <th className="text-left py-2 pr-4 text-xs font-bold uppercase text-gray-500">Descripción del servicio</th>
            <th className="text-center py-2 px-2 text-xs font-bold uppercase text-gray-500 w-20">Tipo</th>
            <th className="text-right py-2 px-2 text-xs font-bold uppercase text-gray-500 w-16">Cant.</th>
            <th className="text-right py-2 px-2 text-xs font-bold uppercase text-gray-500 w-24">Tarifa</th>
            <th className="text-right py-2 pl-2 text-xs font-bold uppercase text-gray-500 w-28">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {cot.servicios.map((s, i) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td className="py-2 pr-4 text-gray-800">{s.descripcion || '—'}</td>
              <td className="py-2 px-2 text-center text-xs text-gray-500">{s.tipo === 'HORA' ? 'Por hora' : 'Fijo'}</td>
              <td className="py-2 px-2 text-right text-gray-700">{Number(s.cantidad).toFixed(s.tipo === 'HORA' ? 1 : 0)}</td>
              <td className="py-2 px-2 text-right text-gray-700 font-mono text-xs">{fmtB(s.tarifa)}</td>
              <td className="py-2 pl-2 text-right font-semibold font-mono text-xs">{fmtB(Number(s.cantidad) * Number(s.tarifa))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-6">
        <div className="min-w-56 text-sm space-y-1">
          <div className="flex justify-between gap-8 text-gray-600 pt-1" style={{ borderTop: '1px solid #E5E7EB' }}>
            <span>Subtotal honorarios</span>
            <span className="font-mono">{fmtB(subtotalHonorarios)}</span>
          </div>
          {ajuste !== 0 && (
            <div className={`flex justify-between gap-8 ${ajuste < 0 ? 'text-red-700' : 'text-green-700'}`}>
              <span>Ajuste ({ajuste > 0 ? '+' : ''}{ajuste}%)</span>
              <span className="font-mono">{ajuste > 0 ? '+' : ''}{fmtB(montoAjuste)}</span>
            </div>
          )}
          <div className="flex justify-between gap-8 font-bold text-gray-900 pt-1" style={{ borderTop: '1px solid #374151' }}>
            <span>Total honorarios</span>
            <span className="font-mono">{fmtB(totalHonorarios)}</span>
          </div>
        </div>
      </div>

      {cot.gastos.length > 0 && (
        <>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">II. Gastos Reembolsables</p>
          <table className="w-full text-sm mb-1" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <th className="text-left py-2 pr-4 text-xs font-bold uppercase text-gray-500">Descripción</th>
                <th className="text-right py-2 pl-2 text-xs font-bold uppercase text-gray-500 w-28">Monto</th>
              </tr>
            </thead>
            <tbody>
              {cot.gastos.map((g) => (
                <tr key={g.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td className="py-2 pr-4 text-gray-800">{g.descripcion || '—'}</td>
                  <td className="py-2 pl-2 text-right font-mono text-xs">{fmtB(g.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end mb-6">
            <div className="min-w-56 text-sm pt-1" style={{ borderTop: '1px solid #374151' }}>
              <div className="flex justify-between gap-8 font-bold text-gray-900">
                <span>Total gastos</span>
                <span className="font-mono">{fmtB(subtotalGastos)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="p-4 mb-6" style={{ background: '#1E1B4B', borderRadius: '8px' }}>
        <div className="flex items-center justify-between text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-70">Total General</p>
            {cot.gastos.length > 0 && (
              <p className="text-xs opacity-50 mt-0.5">Honorarios {fmtB(totalHonorarios)} + Gastos {fmtB(subtotalGastos)}</p>
            )}
          </div>
          <p className="text-2xl font-black font-mono">{fmtB(total)}</p>
        </div>
      </div>

      {cot.notas && (
        <div className="mb-6 p-3 border border-gray-200 rounded-lg">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">Notas y Condiciones</p>
          <p className="text-xs text-gray-700 whitespace-pre-wrap">{cot.notas}</p>
        </div>
      )}

      <div className="mt-10 pt-4" style={{ borderTop: '1px solid #E5E7EB' }}>
        <div className="flex justify-between items-end">
          <div>
            <div style={{ borderTop: '1px solid #374151', width: '200px', marginBottom: '4px' }} />
            <p className="text-xs text-gray-500">Firma del abogado responsable</p>
          </div>
          <p className="text-[9px] text-gray-400 text-right max-w-xs leading-relaxed">
            Los honorarios mínimos son regulados por el Acuerdo No. 49 de 9 de agosto de 2001 del Órgano Judicial de la República de Panamá. Esta cotización no constituye contrato.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function CotizadorPage() {
  const { user } = useAuth();
  const { plantillas: customPlantillas, guardar: guardarCustom, eliminar: eliminarCustom } = usePlantillasCustom();

  const [cot, setCot]               = useState(COT_INIT);
  const [showPanel, setShowPanel]   = useState(false);
  const [showTarifas, setShowTarifas] = useState(false);
  const [showSave, setShowSave]     = useState(false);
  const [showFacturar, setShowFacturar] = useState(false);
  const [showEmail, setShowEmail]   = useState(false);
  const [tarifaCalc, setTarifaCalc] = useState(null);
  const [nomPlant, setNomPlant]     = useState('');
  const [descPlant, setDescPlant]   = useState('');

  const totales = useMemo(() => {
    const subtH = cot.servicios.reduce((s, r) => s + Number(r.cantidad) * Number(r.tarifa), 0);
    const ajuste = subtH * (Number(cot.ajustePorcentaje) / 100);
    const totH   = subtH + ajuste;
    const subtG  = cot.gastos.reduce((s, g) => s + Number(g.monto), 0);
    return { subtotalHonorarios: subtH, montoAjuste: ajuste, totalHonorarios: totH, subtotalGastos: subtG, total: totH + subtG };
  }, [cot]);

  const sf    = (f) => (e) => setCot((c) => ({ ...c, [f]: e.target.value }));
  const setAj = (v) => setCot((c) => ({ ...c, ajustePorcentaje: v }));

  const updS = (id, f, v) => setCot((c) => ({ ...c, servicios: c.servicios.map(s => s.id === id ? { ...s, [f]: v } : s) }));
  const addS = () => setCot((c) => ({ ...c, servicios: [...c.servicios, newServicio()] }));
  const delS = (id) => setCot((c) => ({ ...c, servicios: c.servicios.filter(s => s.id !== id) }));

  const updG = (id, f, v) => setCot((c) => ({ ...c, gastos: c.gastos.map(g => g.id === id ? { ...g, [f]: v } : g) }));
  const addG = () => setCot((c) => ({ ...c, gastos: [...c.gastos, newGasto()] }));
  const delG = (id) => setCot((c) => ({ ...c, gastos: c.gastos.filter(g => g.id !== id) }));

  const cargarPlantilla = (p) => {
    setCot((c) => ({
      ...c,
      servicios: p.servicios.map(s => ({ ...s, id: uid() })),
      gastos:    p.gastos.map(g => ({ ...g, id: uid() })),
    }));
    setShowPanel(false);
  };

  const handleGuardar = () => {
    if (!nomPlant.trim()) return;
    guardarCustom({
      nombre:      nomPlant.trim(),
      descripcion: descPlant.trim(),
      servicios:   cot.servicios.map(({ id, ...r }) => r),
      gastos:      cot.gastos.map(({ id, ...r }) => r),
    });
    setNomPlant(''); setDescPlant(''); setShowSave(false);
  };

  const handleTarifaAdd = (item) => {
    if (item.tipo === 'RANGO' || item.tipo === 'PORCENTAJE') {
      setTarifaCalc(item);
      return;
    }
    const tipoServicio = item.tipo === 'HORA' ? 'HORA' : 'FIJO';
    const nuevoServicio = {
      id:          uid(),
      descripcion: item.label,
      tipo:        tipoServicio,
      cantidad:    1,
      tarifa:      item.monto,
    };
    setCot(c => ({ ...c, servicios: [...c.servicios, nuevoServicio] }));
    toast.success(`"${item.label}" agregado`);
  };

  const handleCalcAdd = ({ tarifa, descripcion }) => {
    const nuevoServicio = {
      id: uid(), descripcion, tipo: 'FIJO', cantidad: 1, tarifa,
    };
    setCot(c => ({ ...c, servicios: [...c.servicios, nuevoServicio] }));
    toast.success(`"${descripcion}" agregado`);
  };

  const ajusteNum = Number(cot.ajustePorcentaje);
  const firma = user?.firma?.nombre ?? 'Firma de Abogados';

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-show { display: block !important; }
          @page { margin: 1.2cm; size: letter; }
        }
        .print-show { display: none; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="no-print bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Calculator className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Cotizador</h1>
              <p className="text-xs text-gray-500">Genera cotizaciones de honorarios profesionales</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowTarifas(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-amber-700 border border-amber-300 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors font-medium"
            >
              <List className="w-4 h-4" /> Tarifas Acuerdo 49
            </button>
            <button onClick={() => setShowPanel(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <BookOpen className="w-4 h-4" /> Plantillas
            </button>
            <button onClick={() => setShowSave(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Save className="w-4 h-4" /> Guardar plantilla
            </button>
            <button onClick={() => setCot(COT_INIT())} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Plus className="w-4 h-4" /> Nueva
            </button>
            {totales.total > 0 && (
              <>
                <button
                  onClick={() => setShowEmail(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Mail className="w-4 h-4" /> Enviar
                </button>
                <button
                  onClick={() => setShowFacturar(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Send className="w-4 h-4" /> Facturar
                </button>
              </>
            )}
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* ── Panels ──────────────────────────────────────────────────── */}
      {showPanel && (
        <PlantillasPanel
          custom={customPlantillas}
          onLoad={cargarPlantilla}
          onDelete={eliminarCustom}
          onClose={() => setShowPanel(false)}
        />
      )}

      {showTarifas && (
        <TarifasPanel
          onAdd={handleTarifaAdd}
          onClose={() => setShowTarifas(false)}
        />
      )}

      {tarifaCalc && (
        <TarifaCalcModal
          tarifa={tarifaCalc}
          onAdd={handleCalcAdd}
          onClose={() => setTarifaCalc(null)}
        />
      )}

      {showFacturar && (
        <ConvertirFacturaModal
          cot={cot}
          totales={totales}
          onClose={() => setShowFacturar(false)}
        />
      )}

      {showEmail && (
        <EnviarCotizacionModal
          cot={cot}
          totales={totales}
          onClose={() => setShowEmail(false)}
        />
      )}

      {/* ── Guardar modal ───────────────────────────────────────────── */}
      {showSave && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Guardar como plantilla</h3>
              <button onClick={() => setShowSave(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nombre <span className="text-red-500">*</span></label>
                <input autoFocus value={nomPlant} onChange={(e) => setNomPlant(e.target.value)}
                  placeholder="Ej: Proceso ordinario estándar"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripción (opcional)</label>
                <input value={descPlant} onChange={(e) => setDescPlant(e.target.value)}
                  placeholder="Breve descripción"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowSave(false)} className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={handleGuardar} disabled={!nomPlant.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Editor ──────────────────────────────────────────────────── */}
      <div className="no-print max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Datos */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Datos de la cotización</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Cliente / Destinatario</label>
              <input value={cot.cliente} onChange={sf('cliente')} placeholder="Nombre del cliente"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Referencia</label>
              <input value={cot.referencia} onChange={sf('referencia')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input type="date" value={cot.fecha} onChange={sf('fecha')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Válida por (días)</label>
              <input type="number" min="1" max="365" value={cot.validezDias} onChange={sf('validezDias')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>

        {/* Servicios */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800">Honorarios profesionales</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTarifas(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 bg-amber-50 rounded-lg hover:bg-amber-100"
              >
                <List className="w-3.5 h-3.5" /> Tarifas oficiales
              </button>
              <button onClick={addS} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                <Plus className="w-3.5 h-3.5" /> Agregar renglón
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5 font-semibold">Descripción del servicio</th>
                  <th className="text-center px-3 py-2.5 font-semibold w-28">Tipo</th>
                  <th className="text-right px-3 py-2.5 font-semibold w-24">Cantidad</th>
                  <th className="text-right px-3 py-2.5 font-semibold w-28">Tarifa (B/.)</th>
                  <th className="text-right px-4 py-2.5 font-semibold w-32">Subtotal</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cot.servicios.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2">
                      <input value={s.descripcion} onChange={(e) => updS(s.id, 'descripcion', e.target.value)}
                        placeholder="Descripción del servicio"
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </td>
                    <td className="px-3 py-2">
                      <select value={s.tipo} onChange={(e) => updS(s.id, 'tipo', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400">
                        <option value="HORA">Por hora</option>
                        <option value="FIJO">Fijo</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.5" min="0.5" value={s.cantidad} onChange={(e) => updS(s.id, 'cantidad', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" step="0.01" min="0" value={s.tarifa} onChange={(e) => updS(s.id, 'tarifa', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold text-gray-800">
                      {fmtB(Number(s.cantidad) * Number(s.tarifa))}
                    </td>
                    <td className="px-2 py-2">
                      <button onClick={() => delS(s.id)} className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Ajuste global (%)</label>
                <input type="number" step="1" min="-100" max="500" value={cot.ajustePorcentaje}
                  onChange={(e) => setAj(e.target.value)}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <span className="text-xs text-gray-400">negativo = descuento · positivo = recargo</span>
              </div>
              <div className="text-right space-y-1.5 min-w-56">
                <div className="flex justify-between gap-8 text-sm text-gray-600">
                  <span>Subtotal honorarios</span>
                  <span className="font-mono font-medium">{fmtB(totales.subtotalHonorarios)}</span>
                </div>
                {ajusteNum !== 0 && (
                  <div className={`flex justify-between gap-8 text-sm ${ajusteNum < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <span>Ajuste ({ajusteNum > 0 ? '+' : ''}{ajusteNum}%)</span>
                    <span className="font-mono">{ajusteNum > 0 ? '+' : ''}{fmtB(totales.montoAjuste)}</span>
                  </div>
                )}
                <div className="flex justify-between gap-8 text-sm font-bold text-gray-900 pt-1.5 border-t border-gray-300">
                  <span>Total honorarios</span>
                  <span className="font-mono">{fmtB(totales.totalHonorarios)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gastos */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-800">Gastos reembolsables</h2>
            <button onClick={addG} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-800">
              <Plus className="w-3.5 h-3.5" /> Agregar gasto
            </button>
          </div>

          {cot.gastos.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Sin gastos. Agrega tasas judiciales, notaría, registro, etc.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="text-left px-4 py-2.5 font-semibold">Descripción del gasto</th>
                      <th className="text-right px-4 py-2.5 font-semibold w-40">Monto (B/.)</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {cot.gastos.map((g) => (
                      <tr key={g.id}>
                        <td className="px-4 py-2">
                          <input value={g.descripcion} onChange={(e) => updG(g.id, 'descripcion', e.target.value)}
                            placeholder="Ej: Tasa judicial, Notaría, Registro Público..."
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" step="0.01" min="0" value={g.monto} onChange={(e) => updG(g.id, 'monto', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        </td>
                        <td className="px-2 py-2">
                          <button onClick={() => delG(g.id)} className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
                <div className="flex justify-between gap-8 text-sm font-bold text-gray-900 min-w-56">
                  <span>Total gastos</span>
                  <span className="font-mono">{fmtB(totales.subtotalGastos)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Total general */}
        <div className="bg-indigo-700 rounded-xl p-5 flex items-center justify-between text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-70">Total General</p>
            {cot.gastos.length > 0 && (
              <p className="text-xs opacity-50 mt-0.5">
                Honorarios {fmtB(totales.totalHonorarios)} + Gastos {fmtB(totales.subtotalGastos)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <p className="text-4xl font-black font-mono">{fmtB(totales.total)}</p>
            {totales.total > 0 && (
              <button
                onClick={() => setShowFacturar(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-semibold transition-colors"
              >
                <Send className="w-4 h-4" /> Facturar
              </button>
            )}
          </div>
        </div>

        {/* Notas */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Notas y condiciones</label>
          <textarea value={cot.notas} onChange={sf('notas')} rows={3}
            placeholder="Condiciones de pago, alcances, exclusiones, etc."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Los honorarios mínimos están regulados por el Acuerdo No. 49 de 9 de agosto de 2001 del Órgano Judicial de la República de Panamá.
          </p>
        </div>
      </div>

      {/* ── Print document ──────────────────────────────────────────── */}
      <PrintDoc cot={cot} firma={firma} totales={totales} />
    </div>
  );
}
