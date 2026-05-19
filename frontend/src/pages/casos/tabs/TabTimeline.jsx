import Spinner from '../../../components/ui/Spinner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  FolderOpen, GitBranch, Gavel, Clock, File,
  CheckSquare, MessageCircle, Timer,
} from 'lucide-react';

const ICONOS = {
  CASO_CREADO:    { icon: FolderOpen,    bg: 'bg-indigo-100',  text: 'text-indigo-600' },
  ESTADO_CAMBIADO:{ icon: GitBranch,     bg: 'bg-purple-100',  text: 'text-purple-600' },
  AUDIENCIA:      { icon: Gavel,         bg: 'bg-blue-100',    text: 'text-blue-600'   },
  TERMINO:        { icon: Clock,         bg: 'bg-orange-100',  text: 'text-orange-600' },
  DOCUMENTO:      { icon: File,          bg: 'bg-gray-100',    text: 'text-gray-600'   },
  TAREA:          { icon: CheckSquare,   bg: 'bg-green-100',   text: 'text-green-600'  },
  COMUNICACION:   { icon: MessageCircle, bg: 'bg-cyan-100',    text: 'text-cyan-600'   },
  HORAS:          { icon: Timer,         bg: 'bg-yellow-100',  text: 'text-yellow-600' },
};

const estadoColor = {
  REALIZADA:  'text-green-600',
  SUSPENDIDA: 'text-yellow-600',
  CANCELADA:  'text-red-500',
  COMPLETADO: 'text-green-600',
  VENCIDO:    'text-red-500',
  PENDIENTE:  'text-blue-600',
};

function EventoItem({ evento, esUltimo }) {
  const cfg = ICONOS[evento.tipo] ?? ICONOS.DOCUMENTO;
  const Icon = cfg.icon;
  const fecha = evento.fecha ? parseISO(evento.fecha) : null;

  return (
    <div className="flex gap-4">
      {/* Línea vertical */}
      <div className="flex flex-col items-center">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${cfg.bg}`}>
          <Icon className={`w-4 h-4 ${cfg.text}`} />
        </div>
        {!esUltimo && <div className="w-px flex-1 bg-gray-200 mt-1" />}
      </div>

      {/* Contenido */}
      <div className={`pb-6 flex-1 min-w-0 ${esUltimo ? '' : ''}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">{evento.titulo}</p>
            {evento.descripcion && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{evento.descripcion}</p>
            )}
            {evento.actor && (
              <p className="text-xs text-gray-400 mt-0.5">por {evento.actor}</p>
            )}
            {evento.estado && (
              <span className={`text-xs font-medium ${estadoColor[evento.estado] ?? 'text-gray-500'}`}>
                {evento.estado}
              </span>
            )}
          </div>
          {fecha && (
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-500">
                {format(fecha, "d MMM yyyy", { locale: es })}
              </p>
              <p className="text-xs text-gray-400">
                {format(fecha, "HH:mm")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TabTimeline({ timeline }) {
  if (!timeline) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size="lg" />
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p>Sin actividad registrada</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-6">
        {timeline.length} evento{timeline.length !== 1 ? 's' : ''}
      </h2>
      {timeline.map((evento, i) => (
        <EventoItem
          key={`${evento.tipo}-${i}`}
          evento={evento}
          esUltimo={i === timeline.length - 1}
        />
      ))}
    </div>
  );
}
