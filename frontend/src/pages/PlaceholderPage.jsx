import { Construction } from 'lucide-react';

export default function PlaceholderPage({ titulo }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
      <Construction className="w-12 h-12 mb-3 opacity-40" />
      <p className="text-lg font-medium">{titulo}</p>
      <p className="text-sm mt-1">Módulo en construcción</p>
    </div>
  );
}
