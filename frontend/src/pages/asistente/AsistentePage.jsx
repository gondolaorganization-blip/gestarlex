import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { consultarIA } from '../../api/ia';
import { getCasos } from '../../api/casos';
import { useAuth } from '../../contexts/AuthContext';
import {
  Bot, Send, Trash2, FolderOpen, X,
  AlertTriangle, Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const SUGERENCIAS = [
  '¿Cuál es el plazo para contestar una demanda civil según la Ley 402 de 2023?',
  '¿Cómo se calcula la indemnización por despido injustificado en Panamá?',
  '¿Qué requisitos tiene una demanda laboral ante el MITRADEL?',
  '¿Cuál es el proceso para ejecutar una sentencia civil?',
  'Explica los tipos de recursos judiciales disponibles en el proceso civil panameño.',
];

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 shrink-0">
        <Bot className="w-3.5 h-3.5 text-indigo-600" />
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.rol === 'user';
  return (
    <div className={`flex items-end gap-2 mb-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      {!isUser && (
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 shrink-0">
          <Bot className="w-3.5 h-3.5 text-indigo-600" />
        </div>
      )}

      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? 'bg-indigo-600 text-white rounded-br-sm'
              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
          }`}
        >
          {msg.contenido}
        </div>
        <span className="text-xs text-gray-400 px-1">
          {format(new Date(msg.ts), 'HH:mm', { locale: es })}
        </span>
      </div>
    </div>
  );
}

export default function AsistentePage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [casoId, setCasoId] = useState('');
  const [showCasoSelector, setShowCasoSelector] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const { data: casos = [] } = useQuery({
    queryKey: ['casos', { estado: 'ACTIVO' }],
    queryFn: () => getCasos({ estado: 'ACTIVO', porPagina: 100 }),
    select: (d) => d.datos ?? [],
  });

  const selectedCaso = casos.find((c) => c.id === casoId);

  const mutation = useMutation({
    mutationFn: (payload) => consultarIA(payload),
    onSuccess: ({ respuesta }) => {
      setMessages((prev) => [
        ...prev,
        { rol: 'assistant', contenido: respuesta, ts: Date.now() },
      ]);
    },
    onError: (err) => {
      const msg = err.response?.data?.message ?? 'Error al contactar el asistente.';
      setMessages((prev) => [
        ...prev,
        { rol: 'assistant', contenido: `⚠️ ${msg}`, ts: Date.now(), error: true },
      ]);
    },
  });

  // Auto-scroll on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mutation.isPending]);

  const handleSend = () => {
    const texto = input.trim();
    if (!texto || mutation.isPending) return;

    const userMsg = { rol: 'user', contenido: texto, ts: Date.now() };
    const historial = messages.map((m) => ({ rol: m.rol, contenido: m.contenido }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    mutation.mutate({
      mensaje: texto,
      casoId: casoId || undefined,
      historial,
    });

    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setCasoId('');
  };

  const handleSugerencia = (texto) => {
    setInput(texto);
    textareaRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] bg-gray-50">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-indigo-600 rounded-xl">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Asistente Legal IA</h1>
              <p className="text-xs text-gray-500">Especializado en derecho panameño</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Contexto de caso */}
            {selectedCaso ? (
              <div className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full">
                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono font-semibold">{selectedCaso.numero}</span>
                <button
                  onClick={() => setCasoId('')}
                  className="ml-0.5 hover:text-indigo-900 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCasoSelector((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-full hover:border-indigo-300 hover:text-indigo-600 transition-colors"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Adjuntar caso
              </button>
            )}

            {messages.length > 0 && (
              <button
                onClick={handleClear}
                title="Limpiar conversación"
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Selector de caso desplegable */}
        {showCasoSelector && !selectedCaso && (
          <div className="max-w-3xl mx-auto mt-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-2">
                Selecciona un caso para que el asistente tenga contexto adicional:
              </p>
              <select
                value={casoId}
                onChange={(e) => {
                  setCasoId(e.target.value);
                  setShowCasoSelector(false);
                }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="">— Sin caso específico —</option>
                {casos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.numero} · {c.titulo}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Mensajes ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">

          {/* Estado vacío con sugerencias */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
                <Bot className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">¿En qué puedo ayudarte?</h2>
              <p className="text-sm text-gray-500 mb-8 max-w-sm">
                Consultame sobre legislación panameña, procedimientos judiciales o dudas de tus casos.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-lg">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSugerencia(s)}
                    className="text-left text-sm text-gray-600 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hilo de mensajes */}
          {messages.map((msg, i) => (
            <Message key={i} msg={msg} />
          ))}

          {/* Indicador de escritura */}
          {mutation.isPending && <TypingIndicator />}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Input ────────────────────────────────────────────────── */}
      <div className="bg-white border-t border-gray-200 px-4 py-4 shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* Advertencia si hay contexto de caso */}
          {selectedCaso && (
            <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-1.5 mb-2">
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              Respondiendo con contexto del caso{' '}
              <span className="font-mono font-semibold">{selectedCaso.numero}</span> —{' '}
              {selectedCaso.titulo}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu consulta legal… (Enter para enviar, Shift+Enter para nueva línea)"
              className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] max-h-[120px] overflow-y-auto"
              style={{ height: '44px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || mutation.isPending}
              className="flex items-center justify-center w-11 h-11 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Las respuestas son orientativas. Siempre validá con tu criterio profesional.
          </p>
        </div>
      </div>
    </div>
  );
}
