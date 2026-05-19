const variants = {
  ACTIVO:       'bg-green-100 text-green-800',
  SUSPENDIDO:   'bg-yellow-100 text-yellow-800',
  CERRADO:      'bg-gray-100 text-gray-700',
  ARCHIVADO:    'bg-gray-100 text-gray-500',
  PENDIENTE:    'bg-blue-100 text-blue-800',
  COMPLETADO:   'bg-green-100 text-green-800',
  VENCIDO:      'bg-red-100 text-red-800',
  EN_PROCESO:   'bg-purple-100 text-purple-800',
  BORRADOR:     'bg-gray-100 text-gray-700',
  ENVIADA:      'bg-blue-100 text-blue-800',
  PAGADA:       'bg-green-100 text-green-800',
  VENCIDA:      'bg-red-100 text-red-800',
  ANULADA:      'bg-gray-100 text-gray-500',
  SOCIO:        'bg-indigo-100 text-indigo-800',
  ASOCIADO:     'bg-cyan-100 text-cyan-800',
  PASANTE:      'bg-orange-100 text-orange-800',
  ADMIN:        'bg-red-100 text-red-800',
  default:      'bg-gray-100 text-gray-700',
};

const labels = {
  ACTIVO: 'Activo', SUSPENDIDO: 'Suspendido', CERRADO: 'Cerrado',
  ARCHIVADO: 'Archivado', PENDIENTE: 'Pendiente', COMPLETADO: 'Completado',
  VENCIDO: 'Vencido', EN_PROCESO: 'En proceso', BORRADOR: 'Borrador',
  ENVIADA: 'Enviada', PAGADA: 'Pagada', VENCIDA: 'Vencida', ANULADA: 'Anulada',
  SOCIO: 'Socio', ASOCIADO: 'Asociado', PASANTE: 'Pasante', ADMIN: 'Admin',
  CIVIL: 'Civil', PENAL: 'Penal', LABORAL: 'Laboral', COMERCIAL: 'Comercial',
  ADMINISTRATIVO: 'Administrativo', FAMILIAR: 'Familiar', MARITIMO: 'Marítimo',
  PERSONA_NATURAL: 'Persona Natural', JURIDICA: 'Jurídica',
};

export default function Badge({ value, className = '' }) {
  const cls = variants[value] ?? variants.default;
  const label = labels[value] ?? value;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls} ${className}`}>
      {label}
    </span>
  );
}
