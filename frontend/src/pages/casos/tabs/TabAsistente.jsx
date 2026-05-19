import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { consultarIA, getUsoIA } from '../../../api/ia';
import { Bot, Send, Trash2, FileText, Sparkles, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const SUGERENCIAS_CASO = [
  'Redacta un memorial de solicitud de término para este caso.',
  'Resume el estado actual del caso y los próximos pasos.',
  '¿Qué documentos debería tener este expediente según la ley?',
  'Redacta una nota de traslado basada en los datos del caso.',
  '¿Cuáles son los riesgos procesales más importantes en este caso?',
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
      {!isUser && (
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 shrink-0">
          <Bot className="w-3.5 h-3.5 text-indigo-600" />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
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

function UsoBadge({ uso }) {
  if (!uso) return null;
  const { consultasUsadas, limite } = uso;
  const ilimitado = limite === -1;
  const pct = ilimitado ? 0 : Math.min((consultasUsadas / limite) * 100, 100);
  const color = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-yellow-600' : 'text-gray-500';
  return (
    <span className={`text-xs ${color}`}>
      {ilimitado ? `${consultasUsadas} consultas este mes` : `${consultasUsadas}/${limite} consultas este mes`}
    </span>
  );
}

export default function TabAsistente({ casoId, caso }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [incluirDocumentos, setIncluirDocumentos] = useState(false);
  const [uso, setUso] = useState(null);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const tieneDocs = (caso?.documentos?.length ?? 0) > 0;

  const { data: usoData } = useQuery({
    queryKey: ['ia-uso'],
    queryFn: getUsoIA,
    retry: false,
  });

  useEffect(() => {
    if (usoData) setUso(usoData);
  }, [usoData]);

  const mutation = useMutation({
    mutationFn: (payload) => consultarIA(payload),
    onSuccess: ({ respuesta, docsLeidos, uso: nuevoUso }) => {
      setMessages((prev) => [
        ...prev,
        {
          rol: 'assistant',
          contenido: respuesta,
          ts: Date.now(),
          docsLeidos,
        },
      ]);
      if (nuevoUso) setUso(nuevoUso);
    },
    onError: (err) => {
      const msg = err.response?.data?.message ?? 'Error al contactar el asistente.';
      setMessages((prev) => [
        ...prev,
        { rol: 'assistant', contenido: `⚠️ ${msg}`, ts: Date.now(), error: true },
      ]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mutation.isPending]);

  const handleSend = () => {
    const texto = input.trim();
    if (!texto || mutation.isPending) return;

    const historial = messages.map((m) => ({ rol: m.rol, contenido: m.contenido }));
    setMessages((prev) => [...prev, { rol: 'user', contenido: texto, ts: Date.now() }]);
    setInput('');

    mutation.mutate({
      mensaje: texto,
      casoId,
      incluirDocumentos: incluirDocumentos && tieneDocs,
      historial,
    });

    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-800">Asistente con contexto del caso</span>
        </div>
        <div className="flex items-center gap-3">
          <UsoBadge uso={uso} />
          {tieneDocs && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={incluirDocumentos}
                onChange={(e) => setIncluirDocumentos(e.target.checked)}
                className="w-3.5 h-3.5 accent-indigo-600"
              />
              <FileText className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-600">Leer documentos</span>
            </label>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title="Limpiar conversación"
              className="p-1 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {incluirDocumentos && tieneDocs && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          El asistente leerá el contenido de los documentos del caso. Cada consulta consume más tokens.
        </div>
      )}

      {/* Hilo de mensajes */}
      <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 p-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-2xl mb-3">
              <Bot className="w-6 h-6 text-indigo-600" />
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Asistente listo</p>
            <p className="text-xs text-gray-400 mb-6 max-w-xs">
              Tengo acceso a todos los datos del caso. Podés pedirme redactar documentos, analizar la situación procesal o consultar normativa.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-md">
              {SUGERENCIAS_CASO.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); textareaRef.current?.focus(); }}
                  className="text-left text-xs text-gray-600 bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} />
            ))}
            {mutation.isPending && <TypingIndicator />}
            <div ref={bottomRef} />
          </>
        )}
        {isEmpty && <div ref={bottomRef} />}
      </div>

      {/* Input */}
      <div className="pt-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta… (Enter para enviar)"
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[40px] max-h-[100px] overflow-y-auto"
            style={{ height: '40px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || mutation.isPending}
            className="flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Las respuestas son orientativas. Validá siempre con tu criterio profesional.
        </p>
      </div>
    </div>
  );
}
