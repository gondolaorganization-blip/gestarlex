import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getPoderes, getResumenPoderes, getProximosAVencer, getVencidos, crearPoder, revocarPoder } from '../../api/poderes';
import { getClientes } from '../../api/clientes';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Scale, AlertTriangle, Plus, Search, X, FileText, Download, Printer } from 'lucide-react';
import Spinner from '../../components/ui/Spinner';
import toast from 'react-hot-toast';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const TIPO_LABELS = { GENERAL: 'General', ESPECIAL: 'Especial', JUDICIAL: 'Judicial' };

// ─── GENERADOR DE DOCUMENTOS ──────────────────────────────────────────────────

const TIPOS_PODER_DOC = [
  { id: 'GENERAL_AMPLISIMO', label: 'General Amplísimo', desc: 'Sin limitaciones — administración y disposición total de bienes' },
  { id: 'GENERAL',           label: 'General',           desc: 'Actos de administración ordinaria sin disposición de inmuebles' },
  { id: 'JUDICIAL',          label: 'Especial Judicial', desc: 'Representación ante tribunales de justicia de Panamá' },
  { id: 'MIGRATORIO',        label: 'Especial Migratorio', desc: 'Trámites ante el SNM, Cancillería y consulados' },
  { id: 'ADMINISTRATIVO',    label: 'Especial Administrativo', desc: 'Gestiones ante entidades gubernamentales del Estado' },
  { id: 'COMPRAVENTA',       label: 'Especial Compraventa', desc: 'Compra, venta o hipoteca de bienes inmuebles' },
  { id: 'COBROS',            label: 'Especial Cobros / Bancario', desc: 'Cobros, gestiones bancarias y títulos valores' },
];

const FACULTADES_POR_TIPO = {
  GENERAL_AMPLISIMO: `1. Representarme ante toda clase de tribunales de justicia, autoridades administrativas, entidades gubernamentales, bancos e instituciones financieras de la República de Panamá y del exterior.

2. Comprar, vender, hipotecar, pignorar, gravar y en general disponer de cualquier forma de mis bienes muebles e inmuebles.

3. Cobrar y percibir toda clase de créditos, rentas, salarios, pensiones, intereses, dividendos y valores que me correspondan, otorgando los recibos y finiquitos correspondientes.

4. Suscribir contratos de cualquier naturaleza: compraventa, arrendamiento, préstamo, hipoteca, fianza y cualquier otro instrumento civil o mercantil.

5. Realizar depósitos, retiros y transferencias en cuentas bancarias, gestionar tarjetas de crédito y cualquier instrumento financiero.

6. Representarme ante el Servicio Nacional de Migración, Registro Público de Panamá, Ministerio de Comercio e Industrias y cualquier entidad gubernamental.

7. Endosar y negociar cheques, letras de cambio, pagarés y demás títulos valores.

8. Sustituir o delegar total o parcialmente el presente poder con las mismas facultades.

El presente poder es IRREVOCABLE durante el término de su vigencia y confiere las más amplias facultades de representación reconocidas por las leyes de la República de Panamá.`,

  GENERAL: `1. Cobrar y percibir rentas, créditos, pensiones, salarios, intereses y cualquier suma de dinero que me corresponda.

2. Suscribir contratos de arrendamiento de bienes inmuebles y muebles.

3. Gestionar documentos, permisos, licencias y trámites ante entidades públicas y privadas.

4. Representarme ante autoridades administrativas, judiciales y gubernamentales en asuntos de carácter ordinario.

5. Realizar operaciones bancarias de carácter ordinario en mis cuentas.

6. En general, ejecutar todos los actos necesarios para la buena administración de mis intereses.

LIMITACIÓN: Este poder NO incluye la facultad de vender, hipotecar, gravar ni disponer de bienes inmuebles, ni de contraer obligaciones que excedan los actos ordinarios de administración.`,

  JUDICIAL: `1. Presentar demandas, contestar, reconvenir y oponer excepciones previas y perentorias.

2. Ofrecer, pedir y controvertir toda clase de pruebas.

3. Solicitar medidas cautelares, secuestros, embargos y retenciones.

4. Interponer recursos ordinarios y extraordinarios, incluyendo apelación y casación.

5. Desistir de acciones, transigir, comprometer en árbitros y amigables componedores.

6. Recibir sumas de dinero y otorgar finiquitos y cartas de pago.

7. Sustituir y delegar este poder a otros abogados idóneos de la República de Panamá.

Este poder se extiende a todas las instancias del proceso judicial hasta su terminación definitiva y ejecutoria.`,

  MIGRATORIO: `1. Presentar solicitudes, documentos y escritos ante el Servicio Nacional de Migración (SNM) de Panamá.

2. Solicitar, renovar y gestionar visas, permisos de residencia, permisos de trabajo, cartas de seguridad y cualquier otro documento migratorio.

3. Actuar ante el Ministerio de Relaciones Exteriores, consulados y embajadas acreditadas en Panamá y en el exterior.

4. Retirar en mi nombre documentos de identidad, carnés de residencia y cualquier documento oficial migratorio.

5. Pagar tasas, derechos y aranceles relacionados con trámites migratorios.

6. En general, realizar cualquier gestión ante autoridades migratorias nacionales e internacionales que requiera mi presencia personal.`,

  ADMINISTRATIVO: `1. Ministerio de Comercio e Industrias (MICI) — obtención y renovación de licencias comerciales y registros de comercio.

2. Registro Público de Panamá — inscripción de documentos, solicitud de certificados y cancelaciones.

3. Municipio de Panamá y otras entidades municipales — permisos de construcción, uso de suelo y paz y salvo municipal.

4. Autoridad Nacional de Aduanas — trámites de importación, exportación y regímenes aduaneros.

5. Caja de Seguro Social — gestiones relacionadas con afiliaciones, pensiones y beneficios sociales.

6. Ministerio de Trabajo y Desarrollo Laboral — trámites laborales, contratos y permisos de trabajo.

7. Cualquier otra entidad gubernamental que requiera mi intervención o comparecencia personal.`,

  COMPRAVENTA: `1. Negociar, pactar, suscribir y perfeccionar contratos de compraventa sobre bienes inmuebles.

2. Recibir o pagar el precio de compraventa pactado, mediante cheque certificado, transferencia bancaria o cualquier otro medio de pago legalmente reconocido.

3. Suscribir las escrituras públicas de compraventa o hipoteca correspondientes ante Notario Público de la República de Panamá.

4. Solicitar la inscripción del traspaso de dominio o gravamen ante el Registro Público de Panamá y retirar los documentos resultantes.

5. Firmar todos los documentos complementarios, aclaratorios o modificatorios necesarios para perfeccionar la transacción.

6. Hipotecar el inmueble como garantía de préstamos hipotecarios con instituciones financieras debidamente autorizadas.

Este poder es IRREVOCABLE y estará vigente hasta la total ejecución del negocio inmobiliario para el cual ha sido conferido.`,

  COBROS: `1. Cobrar, recibir y dar finiquito por toda clase de créditos, rentas, salarios, prestaciones laborales, liquidaciones, dividendos, intereses y cualquier suma de dinero que me corresponda.

2. Gestionar ante bancos, financieras, cooperativas y demás entidades del sistema financiero panameño: apertura y cierre de cuentas, retiros, depósitos, transferencias y solicitud de instrumentos financieros.

3. Endosar, cobrar y negociar cheques, letras de cambio, pagarés, bonos y cualquier título valor a mi favor.

4. Suscribir contratos de préstamo, crédito y cualquier operación financiera en mi nombre.

5. Reclamar ante autoridades administrativas o judiciales el pago de obligaciones pendientes a mi favor.

6. Otorgar recibos, cartas de pago y finiquitos definitivos.`,
};

const TITULOS_PODER = {
  GENERAL_AMPLISIMO: 'PODER GENERAL AMPLÍSIMO',
  GENERAL:           'PODER GENERAL',
  JUDICIAL:          'PODER ESPECIAL JUDICIAL',
  MIGRATORIO:        'PODER ESPECIAL PARA TRÁMITES MIGRATORIOS',
  ADMINISTRATIVO:    'PODER ESPECIAL PARA TRÁMITES ADMINISTRATIVOS',
  COMPRAVENTA:       'PODER ESPECIAL PARA COMPRAVENTA DE BIENES INMUEBLES',
  COBROS:            'PODER ESPECIAL PARA COBROS Y GESTIONES BANCARIAS',
};

function generarDocumento(form) {
  const f = form;

  // Domicilio detallado
  const partesdom = [
    f.domNumero      && `Casa/Apto./Of. No. ${f.domNumero}`,
    f.domBarrio      && `Barriada ${f.domBarrio}`,
    f.domCorregimiento && `Corregimiento de ${f.domCorregimiento}`,
    f.domDistrito    && `Distrito de ${f.domDistrito}`,
    f.domProvincia   && `Provincia de ${f.domProvincia}`,
    f.domPais        || 'República de Panamá',
  ].filter(Boolean);
  const domicilio = partesdom.length ? partesdom.join(', ') : '___________';

  // Documento de identidad
  const docId = f.docTipo === 'cedula'
    ? `cédula de identidad personal número ${f.cedulaPoderdante || '___________'}`
    : `pasaporte número ${f.pasaportePoderdante || '___________'}`;

  // Bloque poderdante
  let bloquePoderante;
  if (!f.esPJ) {
    bloquePoderante = `Yo, ${f.nombrePoderdante || '______________________'}, de nacionalidad ${f.nacionalidad || '___________'}, mayor de edad, ${f.estadoCivil || '___________'}, de profesión u oficio ${f.profesion || '___________'}, con ${docId}, con domicilio en ${domicilio},`;
  } else {
    const regPub = [
      f.pjFicha    && `Ficha ${f.pjFicha}`,
      f.pjTomo     && `Tomo ${f.pjTomo}`,
      f.pjFolio    && `Folio ${f.pjFolio}`,
      f.pjProvincia && `Provincia de ${f.pjProvincia}`,
    ].filter(Boolean).join(', ');
    bloquePoderante = `Yo, ${f.pjRepNombre || '______________________'}, en mi carácter de ${f.pjRepCargo || 'Representante Legal'} de la ${f.pjTipoSociedad || 'Sociedad Anónima'} denominada ${f.pjRazonSocial || '______________________'}, inscrita en el Registro Público de la República de Panamá${regPub ? ` (${regPub})` : ''}, con domicilio en ${domicilio}, identificado(a) con cédula de identidad personal número ${f.pjRepCedula || '___________'},`;
  }

  // Bloque apoderado
  let bloqueApoderado;
  if (!f.esFirma) {
    const contacto = [
      f.telefonoApoderado && `Tel. ${f.telefonoApoderado}`,
      f.emailApoderado,
    ].filter(Boolean).join(', ');
    bloqueApoderado = `${f.nombreApoderado || '______________________'}, abogado(a) idóneo(a) de la República de Panamá, con cédula de identidad personal número ${f.cedulaApoderado || '___________'}, inscrito(a) en el Registro Público con número de idoneidad ${f.idoneidad || '___________'}${contacto ? `, ${contacto}` : ''}`;
  } else {
    const regFirma = [
      f.firmaFicha    && `Ficha ${f.firmaFicha}`,
      f.firmaFolio    && `Folio ${f.firmaFolio}`,
      f.firmaProvincia && `Provincia de ${f.firmaProvincia}`,
    ].filter(Boolean).join(', ');
    const rep = f.firmaRepNombre
      ? `, representada en este acto por ${f.firmaRepNombre}, cédula ${f.firmaRepCedula || '___________'}, idoneidad No. ${f.firmaRepIdoneidad || '___________'}`
      : '';
    const contactoFirma = [f.firmaTelefono && `Tel. ${f.firmaTelefono}`, f.firmaEmail].filter(Boolean).join(', ');
    bloqueApoderado = `la firma de abogados ${f.firmaRazonSocial || '______________________'}, inscrita en el Registro Público de la República de Panamá${regFirma ? ` (${regFirma})` : ''}${rep}, con dirección en ${f.firmaDireccion || '___________'}${contactoFirma ? `, ${contactoFirma}` : ''}`;
  }

  // Contraparte
  let contraparteTxt = '';
  if (f.esContencioso && (f.ctNombre || f.ctPjRazonSocial)) {
    const ctDom = [
      f.ctDomNumero      && `Casa/Apto./Of. No. ${f.ctDomNumero}`,
      f.ctDomBarrio      && `Barriada ${f.ctDomBarrio}`,
      f.ctDomCorregimiento && `Corregimiento de ${f.ctDomCorregimiento}`,
      f.ctDomDistrito    && `Distrito de ${f.ctDomDistrito}`,
      f.ctDomProvincia   && `Provincia de ${f.ctDomProvincia}`,
      f.ctDomPais        || 'República de Panamá',
    ].filter(Boolean).join(', ');

    let ctBloque;
    if (!f.ctEsPJ) {
      const ctDoc = f.ctDocTipo === 'cedula'
        ? (f.ctCedula ? `, con cédula de identidad personal número ${f.ctCedula}` : '')
        : (f.ctPasaporte ? `, con pasaporte número ${f.ctPasaporte}` : '');
      const ctDatos = [
        f.ctNacionalidad && `de nacionalidad ${f.ctNacionalidad}`,
        f.ctEstadoCivil,
        f.ctProfesion && `de profesión ${f.ctProfesion}`,
      ].filter(Boolean).join(', ');
      ctBloque = `${f.ctNombre || '______________________'}${ctDatos ? ', ' + ctDatos : ''}${ctDoc}${ctDom ? `, con domicilio en ${ctDom}` : ''}`;
    } else {
      const ctReg = [
        f.ctPjFicha  && `Ficha ${f.ctPjFicha}`,
        f.ctPjTomo   && `Tomo ${f.ctPjTomo}`,
        f.ctPjFolio  && `Folio ${f.ctPjFolio}`,
        f.ctPjProvincia && `Provincia de ${f.ctPjProvincia}`,
      ].filter(Boolean).join(', ');
      const ctRep = f.ctPjRepNombre
        ? `, representada por ${f.ctPjRepNombre} (${f.ctPjRepCargo || 'Representante Legal'})${f.ctPjRepCedula ? `, cédula ${f.ctPjRepCedula}` : ''}`
        : '';
      ctBloque = `${f.ctPjRazonSocial || '______________________'} (${f.ctPjTipoSociedad || 'Sociedad Anónima'}), inscrita en el Registro Público de la República de Panamá${ctReg ? ` (${ctReg})` : ''}${ctRep}${ctDom ? `, con domicilio en ${ctDom}` : ''}`;
    }

    contraparteTxt = `\n\nDATOS DE LA CONTRAPARTE:\n${ctBloque}.`;
  }

  // Fecha
  const fechaFmt = f.fecha
    ? new Date(f.fecha + 'T12:00:00').toLocaleDateString('es-PA', { day: 'numeric', month: 'long', year: 'numeric' })
    : '_____ de ________________ de _____';

  const titulo = TITULOS_PODER[f.tipoPoder] ?? 'PODER';
  const facultades = FACULTADES_POR_TIPO[f.tipoPoder] ?? '___________________________________________';

  const nombreFirmante = f.esPJ
    ? (f.pjRepNombre || '______________________')
    : (f.nombrePoderdante || '______________________');
  const cargoFirmante = f.esPJ
    ? `${f.pjRepCargo || 'Representante Legal'}\n${f.pjRazonSocial || ''}`
    : 'Poderdante';

  const cuerpo =
`${bloquePoderante} por medio del presente instrumento público,

OTORGO ${titulo} a favor de ${bloqueApoderado},

a fin de que ${f.objetoPoder || '___________________________________________'}.${contraparteTxt}


FACULTADES:

${facultades}


Dado y firmado en la ciudad de ${f.ciudad || 'Panamá'}, República de Panamá, a los ${fechaFmt}.


___________________________________
${nombreFirmante}
${cargoFirmante}


NOTA: Este documento es un borrador de referencia generado por GESTARLEX. Debe ser revisado por el abogado antes de su uso.`;

  return {
    titulo,
    tipoProceso: f.tipoProceso || '',
    partes: f.esContencioso && (f.parteActora || f.parteDemandada)
      ? `${f.parteActora || '___________'}\nvs.\n${f.parteDemandada || '___________'}`
      : '',
    autoridadDirigida: f.autoridadDirigida || '',
    cuerpo,
  };
}

function buildDocHtml(docData) {
  const { titulo, tipoProceso, partes, autoridadDirigida, cuerpo } = docData;

  const headerHtml = (tipoProceso || partes) ? `
    <div class="doc-header">
      <div class="tipo-proceso">${tipoProceso.replace(/\n/g, '<br>')}</div>
      <div class="partes">${partes.replace(/\n/g, '<br>')}</div>
    </div>` : '';

  const autoridadHtml = autoridadDirigida
    ? `<p class="autoridad">${autoridadDirigida}</p><br>`
    : '';

  const bodyHtml = cuerpo.split('\n').map(line => {
    const t = line.trim();
    if (!t) return '<br/>';
    if (/^OTORGO |^FACULTADES:|^LIMITACIÓN:|^NOTA:/.test(t))
      return `<p class="bold">${t}</p>`;
    return `<p>${t}</p>`;
  }).join('');

  return `${headerHtml}<h1>${titulo}</h1>${autoridadHtml}${bodyHtml}`;
}

function imprimirDocumento(docData) {
  const win = window.open('', '_blank');
  if (!win) { toast.error('Permite ventanas emergentes para imprimir.'); return; }
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.8;color:#000}
    .doc-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18pt}
    .tipo-proceso{font-size:11pt;font-weight:bold;text-transform:uppercase;max-width:50%}
    .partes{font-size:11pt;text-align:right;max-width:45%}
    h1{font-size:13pt;text-align:center;text-transform:uppercase;margin:0 0 16pt;letter-spacing:1px;font-weight:bold}
    .autoridad{font-size:12pt;margin:0 0 16pt}
    p{text-align:justify;margin:0 0 7pt}
    p.bold{font-weight:bold;margin:10pt 0 5pt;text-align:left}
    @page{margin:2.5cm;size:8.5in 14.0in}
  </style></head><body>${buildDocHtml(docData)}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}

function exportarWord(docData) {
  const inner = buildDocHtml(docData);
  const word = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><style>
  @page{size:8.5in 14.0in;margin:2.5cm;mso-paper-source:0}
  body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.8}
  .doc-header{display:flex;justify-content:space-between;margin-bottom:18pt}
  .tipo-proceso{font-weight:bold;text-transform:uppercase}
  .partes{text-align:right}
  h1{font-size:13pt;text-align:center;text-transform:uppercase;margin:0 0 16pt;font-weight:bold}
  .autoridad{margin:0 0 16pt}
  p{text-align:justify;margin:0 0 7pt}
  p.bold{font-weight:bold;margin:10pt 0 5pt}
</style></head><body>${inner}</body></html>`;
  const blob = new Blob(['﻿', word], { type: 'application/vnd.ms-word;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${docData.titulo.replace(/\s+/g, '_')}.doc`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getColorClass(color) {
  switch (color) {
    case 'VENCIDO': return { row: 'bg-red-50',     badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500' };
    case 'ROJO':    return { row: 'bg-red-50',     badge: 'bg-red-100 text-red-700',       dot: 'bg-red-400' };
    case 'NARANJA': return { row: 'bg-orange-50',  badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' };
    case 'AMARILLO':return { row: 'bg-yellow-50',  badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' };
    case 'VERDE':   return { row: '',              badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500' };
    case 'GRIS':    return { row: 'bg-gray-50',    badge: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400' };
    default:        return { row: '',              badge: 'bg-gray-100 text-gray-500',     dot: 'bg-gray-400' };
  }
}

function estadoLabel(vencimiento) {
  switch (vencimiento.estado) {
    case 'VIGENTE':     return 'Vigente';
    case 'INDEFINIDO':  return 'Sin vencimiento';
    case 'PROXIMO':     return `Vence en ${vencimiento.diasRestantes}d`;
    case 'URGENTE':     return `Vence en ${vencimiento.diasRestantes}d`;
    case 'CRITICO':     return `Vence en ${vencimiento.diasRestantes}d`;
    case 'VENCE_HOY':   return 'Vence hoy';
    case 'VENCIDO':     return 'Vencido';
    case 'REVOCADO':    return 'Revocado';
    default:            return vencimiento.estado;
  }
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function PoderesPage() {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroActivo, setFiltroActivo] = useState('true');
  const [pagina, setPagina] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [confirmRevocar, setConfirmRevocar] = useState(null);
  const [showGenerador, setShowGenerador] = useState(false);
  const [generadorCliente, setGeneradorCliente] = useState(null);

  const { data: resumen } = useQuery({
    queryKey: ['poderes-resumen'],
    queryFn: getResumenPoderes,
  });

  const { data: vencidos = [] } = useQuery({
    queryKey: ['poderes-vencidos'],
    queryFn: getVencidos,
  });

  const { data: proximos = [] } = useQuery({
    queryKey: ['poderes-proximos'],
    queryFn: () => getProximosAVencer(30),
  });

  const { data: poderesResp, isLoading } = useQuery({
    queryKey: ['poderes', busqueda, filtroTipo, filtroActivo, pagina],
    queryFn: () => getPoderes({ busqueda: busqueda || undefined, tipo: filtroTipo || undefined, activo: filtroActivo || undefined, pagina, porPagina: 20 }),
    placeholderData: (prev) => prev,
  });

  const poderes = poderesResp?.datos ?? [];
  const paginacion = poderesResp?.paginacion ?? {};

  const mutRevocar = useMutation({
    mutationFn: revocarPoder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['poderes'] });
      qc.invalidateQueries({ queryKey: ['poderes-resumen'] });
      qc.invalidateQueries({ queryKey: ['poderes-vencidos'] });
      toast.success('Poder revocado');
      setConfirmRevocar(null);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al revocar'),
  });

  const statCards = [
    { label: 'Total poderes', value: resumen?.total ?? '—', color: 'text-gray-800' },
    { label: 'Activos',        value: resumen?.activos ?? '—', color: 'text-green-600' },
    { label: 'Vencidos',       value: resumen?.vencidos ?? '—', color: 'text-red-600' },
    { label: 'Próx. 30 días',  value: resumen?.proximosAVencer ?? '—', color: 'text-yellow-600' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Scale className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Control de Poderes</h1>
                <p className="text-xs text-gray-500">Poderes notariales de la firma</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setGeneradorCliente(null); setShowGenerador(true); }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-4 h-4" /> Generar Documento
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Nuevo poder
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            {statCards.map((c) => (
              <div key={c.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {/* Alert banners */}
        {vencidos.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-700 mb-1">
                {vencidos.length} {vencidos.length === 1 ? 'poder vencido' : 'poderes vencidos'} — requieren renovación
              </p>
              <div className="flex flex-wrap gap-2">
                {vencidos.slice(0, 5).map((p) => (
                  <Link key={p.id} to={`/clientes/${p.cliente.id}`} className="text-xs text-red-600 hover:underline">
                    {p.cliente.nombre}
                  </Link>
                ))}
                {vencidos.length > 5 && <span className="text-xs text-red-400">+{vencidos.length - 5} más</span>}
              </div>
            </div>
          </div>
        )}

        {proximos.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-sm text-yellow-700">
              <span className="font-semibold">{proximos.length}</span>{' '}
              {proximos.length === 1 ? 'poder vence' : 'poderes vencen'} en los próximos 30 días
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
                placeholder="Buscar cliente, notaría..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <select
              value={filtroTipo}
              onChange={(e) => { setFiltroTipo(e.target.value); setPagina(1); }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos los tipos</option>
              <option value="GENERAL">General</option>
              <option value="ESPECIAL">Especial</option>
              <option value="JUDICIAL">Judicial</option>
            </select>
            <div className="flex border border-gray-200 rounded-lg overflow-hidden text-sm">
              {[['true', 'Activos'], ['false', 'Revocados'], ['', 'Todos']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setFiltroActivo(val); setPagina(1); }}
                  className={`px-3 py-2 font-medium transition-colors ${
                    filtroActivo === val ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  } border-l border-gray-200 first:border-l-0`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : poderes.length === 0 ? (
            <div className="text-center py-16">
              <Scale className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No se encontraron poderes</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Notaría</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Otorgamiento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vencimiento</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Caso</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {poderes.map((p) => {
                  const c = getColorClass(p.vencimiento?.color);
                  return (
                    <tr key={p.id} className={`hover:bg-gray-50 transition-colors ${c.row}`}>
                      <td className="px-4 py-3">
                        <Link to={`/clientes/${p.cliente.id}`} className="font-medium text-gray-900 hover:text-indigo-600 transition-colors">
                          {p.cliente.nombre}
                        </Link>
                        <p className="text-xs text-gray-400">
                          {p.cliente.cedula || p.cliente.ruc || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full">
                          {TIPO_LABELS[p.tipo] ?? p.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-gray-600">
                        <span>{p.notaria || '—'}</span>
                        {(p.tomo || p.folio) && (
                          <p className="text-xs text-gray-400">T.{p.tomo} F.{p.folio}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                        {p.fechaOtorgamiento
                          ? format(parseISO(p.fechaOtorgamiento), 'dd/MM/yyyy')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${c.badge}`}>
                          {estadoLabel(p.vencimiento)}
                        </span>
                        {p.fechaVence && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {format(parseISO(p.fechaVence), 'dd/MM/yyyy')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {p.caso ? (
                          <Link to={`/casos/${p.caso.id}`} className="text-xs text-indigo-600 hover:underline font-mono">
                            {p.caso.numero}
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => { setGeneradorCliente(p.cliente); setShowGenerador(true); }}
                            className="text-indigo-400 hover:text-indigo-600 transition-colors"
                            title="Generar documento de poder"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          {p.activo && (
                            <button
                              onClick={() => setConfirmRevocar(p)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline"
                            >
                              Revocar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {paginacion.totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {paginacion.total} poderes · Página {paginacion.pagina} de {paginacion.totalPaginas}
              </p>
              <div className="flex gap-1">
                <button
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => p - 1)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  Anterior
                </button>
                <button
                  disabled={pagina >= paginacion.totalPaginas}
                  onClick={() => setPagina((p) => p + 1)}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm revocar */}
      {confirmRevocar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">¿Revocar poder?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Esta acción marcará el poder de{' '}
              <span className="font-semibold">{confirmRevocar.cliente.nombre}</span>{' '}
              como revocado. No se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmRevocar(null)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={() => mutRevocar.mutate(confirmRevocar.id)}
                disabled={mutRevocar.isPending}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {mutRevocar.isPending ? 'Revocando...' : 'Sí, revocar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nuevo poder modal */}
      {showModal && (
        <NuevoPoderModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['poderes'] });
            qc.invalidateQueries({ queryKey: ['poderes-resumen'] });
          }}
        />
      )}

      {/* Generador de documentos */}
      {showGenerador && (
        <GeneradorPoderModal
          clienteInicial={generadorCliente}
          onClose={() => { setShowGenerador(false); setGeneradorCliente(null); }}
        />
      )}
    </div>
  );
}

// ─── MODAL NUEVO PODER ────────────────────────────────────────────────────────

function NuevoPoderModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    clienteId: '',
    tipo: 'ESPECIAL',
    fechaOtorgamiento: '',
    fechaVence: '',
    notaria: '',
    tomo: '',
    folio: '',
    descripcion: '',
  });

  const { data: clientesResp } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: () => getClientes({ porPagina: 200 }),
  });
  const clientes = clientesResp?.datos ?? [];

  const mutation = useMutation({
    mutationFn: crearPoder,
    onSuccess: () => {
      toast.success('Poder registrado exitosamente');
      onSuccess();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Error al registrar el poder'),
  });

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      clienteId: form.clienteId,
      tipo: form.tipo,
      fechaOtorgamiento: form.fechaOtorgamiento,
    };
    if (form.fechaVence) payload.fechaVence = form.fechaVence;
    if (form.notaria) payload.notaria = form.notaria;
    if (form.tomo) payload.tomo = form.tomo;
    if (form.folio) payload.folio = form.folio;
    if (form.descripcion) payload.descripcion = form.descripcion;
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Registrar poder notarial</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Cliente */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Cliente <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.clienteId}
              onChange={(e) => set('clienteId', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Tipo de poder</label>
            <div className="grid grid-cols-3 gap-2">
              {['GENERAL', 'ESPECIAL', 'JUDICIAL'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('tipo', t)}
                  className={`py-2 text-xs font-medium rounded-lg border-2 transition-all ${
                    form.tipo === t
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fecha de otorgamiento <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={form.fechaOtorgamiento}
                onChange={(e) => set('fechaOtorgamiento', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de vencimiento</label>
              <input
                type="date"
                value={form.fechaVence}
                onChange={(e) => set('fechaVence', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Notaría */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notaría</label>
            <input
              value={form.notaria}
              onChange={(e) => set('notaria', e.target.value)}
              placeholder="Ej: Notaría 5ª del Circuito de Panamá"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Tomo / Folio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tomo</label>
              <input
                value={form.tomo}
                onChange={(e) => set('tomo', e.target.value)}
                placeholder="Ej: 123"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Folio</label>
              <input
                value={form.folio}
                onChange={(e) => set('folio', e.target.value)}
                placeholder="Ej: 456"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción / Alcance</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => set('descripcion', e.target.value)}
              rows={2}
              placeholder="Descripción del alcance del poder..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {mutation.isPending ? 'Guardando...' : 'Guardar poder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── GENERADOR DE PODERES ─────────────────────────────────────────────────────

const FORM_GENERADOR_INIT = (clienteInicial) => ({
  // Proceso / cabecera
  tipoPoder: '', esContencioso: false,
  tipoProceso: '', parteActora: '', parteDemandada: '', autoridadDirigida: '',
  // Poderdante
  clienteId: clienteInicial?.id ?? '', esPJ: false,
  nombrePoderdante: clienteInicial?.nombre ?? '',
  docTipo: clienteInicial?.cedula ? 'cedula' : 'pasaporte',
  cedulaPoderdante: clienteInicial?.cedula ?? '', pasaportePoderdante: '',
  nacionalidad: 'panameña', estadoCivil: '', profesion: '',
  domBarrio: '', domNumero: '', domCorregimiento: '', domDistrito: '',
  domProvincia: 'Panamá', domPais: 'República de Panamá',
  // Persona jurídica
  pjRazonSocial: '', pjTipoSociedad: 'Sociedad Anónima',
  pjFicha: '', pjTomo: '', pjFolio: '', pjProvincia: 'Panamá',
  pjRepNombre: '', pjRepCargo: 'Representante Legal', pjRepCedula: '',
  // Apoderado
  esFirma: false, nombreApoderado: '', cedulaApoderado: '', idoneidad: '',
  telefonoApoderado: '', emailApoderado: '',
  firmaRazonSocial: '', firmaFicha: '', firmaFolio: '', firmaProvincia: 'Panamá',
  firmaRepNombre: '', firmaRepCedula: '', firmaRepIdoneidad: '',
  firmaTelefono: '', firmaEmail: '', firmaDireccion: '',
  // Objeto
  objetoPoder: '',
  // Contraparte
  ctEsPJ: false,
  ctNombre: '', ctDocTipo: 'cedula', ctCedula: '', ctPasaporte: '',
  ctNacionalidad: '', ctEstadoCivil: '', ctProfesion: '',
  ctDomNumero: '', ctDomBarrio: '', ctDomCorregimiento: '',
  ctDomDistrito: '', ctDomProvincia: 'Panamá', ctDomPais: 'República de Panamá',
  ctPjRazonSocial: '', ctPjTipoSociedad: 'Sociedad Anónima',
  ctPjFicha: '', ctPjTomo: '', ctPjFolio: '', ctPjProvincia: 'Panamá',
  ctPjRepNombre: '', ctPjRepCargo: 'Representante Legal', ctPjRepCedula: '',
  // Lugar/fecha
  ciudad: 'Panamá', fecha: new Date().toISOString().split('T')[0],
});

function SeccionLabel({ children }) {
  return <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 mt-1">{children}</p>;
}

function Campo({ label, children, span2 }) {
  return (
    <div className={span2 ? 'col-span-2' : ''}>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      {children}
    </div>
  );
}

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
        checked ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
      }`}
    >
      <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${checked ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`}>
        {checked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      </span>
      {label}
    </button>
  );
}

function GeneradorPoderModal({ clienteInicial, onClose }) {
  const [paso, setPaso] = useState(1);
  const [form, setForm] = useState(() => FORM_GENERADOR_INIT(clienteInicial));
  const [docData, setDocData] = useState(null);

  const { data: clientesResp } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: () => getClientes({ porPagina: 200 }),
  });
  const clientes = clientesResp?.datos ?? [];

  const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  const onClienteChange = (id) => {
    const c = clientes.find(x => x.id === id);
    if (!c) { set('clienteId', id); return; }
    setForm(prev => ({
      ...prev,
      clienteId: id,
      nombrePoderdante: c.nombre ?? '',
      cedulaPoderdante: c.cedula ?? '',
      docTipo: c.cedula ? 'cedula' : 'pasaporte',
    }));
  };

  const handleGenerar = (e) => {
    e.preventDefault();
    setDocData(generarDocumento(form));
    setPaso(2);
  };

  const tipoSeleccionado = TIPOS_PODER_DOC.find(t => t.id === form.tipoPoder);
  const canGenerate = form.tipoPoder &&
    (form.esPJ ? form.pjRazonSocial.trim() && form.pjRepNombre.trim() : form.nombrePoderdante.trim()) &&
    (form.esFirma ? form.firmaRazonSocial.trim() : form.nombreApoderado.trim());

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Generador de Poderes</h2>
              <p className="text-xs text-gray-500">
                {paso === 1 ? 'Paso 1 — Datos del documento' : 'Paso 2 — Vista previa y exportación'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X className="w-4 h-4" /></button>
        </div>

        {paso === 1 ? (
          <form onSubmit={handleGenerar} className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* ── Tipo de poder ───────────────────────────────────────── */}
            <div>
              <SeccionLabel>Tipo de poder *</SeccionLabel>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS_PODER_DOC.map(t => (
                  <button key={t.id} type="button" onClick={() => set('tipoPoder', t.id)}
                    className={`text-left p-2.5 rounded-xl border-2 transition-all ${form.tipoPoder === t.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className={`text-xs font-semibold ${form.tipoPoder === t.id ? 'text-indigo-700' : 'text-gray-800'}`}>{t.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Proceso (solo si contencioso) ───────────────────────── */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Toggle label="Proceso contencioso" checked={form.esContencioso} onChange={v => set('esContencioso', v)} />
                <span className="text-xs text-gray-400">Activa si hay partes contrarias</span>
              </div>
              {form.esContencioso && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo label="Tipo de proceso">
                      <input value={form.tipoProceso} onChange={e => set('tipoProceso', e.target.value)}
                        placeholder="Ej: Proceso Ordinario" className={inp} />
                    </Campo>
                    <Campo label="Parte actora">
                      <input value={form.parteActora} onChange={e => set('parteActora', e.target.value)}
                        placeholder="Ej: Juan Pérez" className={inp} />
                    </Campo>
                  </div>
                  <Campo label="Parte demandada">
                    <input value={form.parteDemandada} onChange={e => set('parteDemandada', e.target.value)}
                      placeholder="Ej: Juana Peña" className={inp} />
                  </Campo>
                </>
              )}
              <Campo label="Autoridad a la que va dirigido">
                <input value={form.autoridadDirigida} onChange={e => set('autoridadDirigida', e.target.value)}
                  placeholder="Ej: Honorable Señor Juez Primero de Circuito del Primer Circuito Judicial de Panamá"
                  className={inp} />
              </Campo>
            </div>

            {/* ── Poderdante ──────────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <SeccionLabel>Poderdante</SeccionLabel>
                <Toggle label="Persona jurídica" checked={form.esPJ} onChange={v => set('esPJ', v)} />
              </div>

              {/* Autocompletar desde clientes */}
              <select value={form.clienteId} onChange={e => onClienteChange(e.target.value)} className={`${inp} mb-3`}>
                <option value="">Seleccionar cliente para autocompletar...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>

              {!form.esPJ ? (
                <div className="space-y-3">
                  <input required value={form.nombrePoderdante} onChange={e => set('nombrePoderdante', e.target.value)}
                    placeholder="Nombre completo *" className={inp} />
                  <div className="grid grid-cols-3 gap-2">
                    <select value={form.docTipo} onChange={e => set('docTipo', e.target.value)} className={inp}>
                      <option value="cedula">Cédula</option>
                      <option value="pasaporte">Pasaporte</option>
                    </select>
                    <input value={form.docTipo === 'cedula' ? form.cedulaPoderdante : form.pasaportePoderdante}
                      onChange={e => set(form.docTipo === 'cedula' ? 'cedulaPoderdante' : 'pasaportePoderdante', e.target.value)}
                      placeholder="Número" className={`col-span-2 ${inp}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.nacionalidad} onChange={e => set('nacionalidad', e.target.value)}
                      placeholder="Nacionalidad" className={inp} />
                    <select value={form.estadoCivil} onChange={e => set('estadoCivil', e.target.value)} className={inp}>
                      <option value="">Estado civil...</option>
                      {['soltero(a)', 'casado(a)', 'divorciado(a)', 'viudo(a)', 'unido(a) en matrimonio de hecho'].map(v =>
                        <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                    </select>
                  </div>
                  <input value={form.profesion} onChange={e => set('profesion', e.target.value)}
                    placeholder="Profesión u oficio" className={inp} />
                  <p className="text-xs font-medium text-gray-500 mt-1">Domicilio detallado</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.domNumero} onChange={e => set('domNumero', e.target.value)}
                      placeholder="N° casa/apto/oficina" className={inp} />
                    <input value={form.domBarrio} onChange={e => set('domBarrio', e.target.value)}
                      placeholder="Barriada / Urbanización" className={inp} />
                    <input value={form.domCorregimiento} onChange={e => set('domCorregimiento', e.target.value)}
                      placeholder="Corregimiento" className={inp} />
                    <input value={form.domDistrito} onChange={e => set('domDistrito', e.target.value)}
                      placeholder="Distrito" className={inp} />
                    <input value={form.domProvincia} onChange={e => set('domProvincia', e.target.value)}
                      placeholder="Provincia" className={inp} />
                    <input value={form.domPais} onChange={e => set('domPais', e.target.value)}
                      placeholder="País" className={inp} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input required value={form.pjRazonSocial} onChange={e => set('pjRazonSocial', e.target.value)}
                      placeholder="Razón social *" className={inp} />
                    <select value={form.pjTipoSociedad} onChange={e => set('pjTipoSociedad', e.target.value)} className={inp}>
                      {['Sociedad Anónima','S.R.L.','Fundación de Interés Privado','Asociación Civil','Cooperativa'].map(v =>
                        <option key={v}>{v}</option>)}
                    </select>
                  </div>
                  <p className="text-xs font-medium text-gray-500">Datos del Registro Público</p>
                  <div className="grid grid-cols-4 gap-2">
                    <input value={form.pjFicha} onChange={e => set('pjFicha', e.target.value)} placeholder="Ficha" className={inp} />
                    <input value={form.pjTomo} onChange={e => set('pjTomo', e.target.value)} placeholder="Tomo" className={inp} />
                    <input value={form.pjFolio} onChange={e => set('pjFolio', e.target.value)} placeholder="Folio" className={inp} />
                    <input value={form.pjProvincia} onChange={e => set('pjProvincia', e.target.value)} placeholder="Provincia" className={inp} />
                  </div>
                  <p className="text-xs font-medium text-gray-500">Representante legal</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input required value={form.pjRepNombre} onChange={e => set('pjRepNombre', e.target.value)}
                      placeholder="Nombre del rep. legal *" className={inp} />
                    <input value={form.pjRepCargo} onChange={e => set('pjRepCargo', e.target.value)}
                      placeholder="Cargo" className={inp} />
                  </div>
                  <input value={form.pjRepCedula} onChange={e => set('pjRepCedula', e.target.value)}
                    placeholder="Cédula del representante" className={inp} />
                  <p className="text-xs font-medium text-gray-500">Domicilio de la sociedad</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.domNumero} onChange={e => set('domNumero', e.target.value)} placeholder="N° oficina" className={inp} />
                    <input value={form.domBarrio} onChange={e => set('domBarrio', e.target.value)} placeholder="Barriada / Edificio" className={inp} />
                    <input value={form.domCorregimiento} onChange={e => set('domCorregimiento', e.target.value)} placeholder="Corregimiento" className={inp} />
                    <input value={form.domDistrito} onChange={e => set('domDistrito', e.target.value)} placeholder="Distrito" className={inp} />
                    <input value={form.domProvincia} onChange={e => set('domProvincia', e.target.value)} placeholder="Provincia" className={inp} />
                    <input value={form.domPais} onChange={e => set('domPais', e.target.value)} placeholder="País" className={inp} />
                  </div>
                </div>
              )}
            </div>

            {/* ── Apoderado ───────────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <SeccionLabel>Apoderado</SeccionLabel>
                <Toggle label="Firma de abogados" checked={form.esFirma} onChange={v => set('esFirma', v)} />
              </div>

              {!form.esFirma ? (
                <div className="space-y-3">
                  <input required value={form.nombreApoderado} onChange={e => set('nombreApoderado', e.target.value)}
                    placeholder="Nombre completo del abogado *" className={inp} />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.cedulaApoderado} onChange={e => set('cedulaApoderado', e.target.value)}
                      placeholder="Cédula" className={inp} />
                    <input value={form.idoneidad} onChange={e => set('idoneidad', e.target.value)}
                      placeholder="N° Idoneidad" className={inp} />
                    <input value={form.telefonoApoderado} onChange={e => set('telefonoApoderado', e.target.value)}
                      placeholder="Teléfono" className={inp} />
                    <input value={form.emailApoderado} onChange={e => set('emailApoderado', e.target.value)}
                      placeholder="Correo electrónico" className={inp} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <input required value={form.firmaRazonSocial} onChange={e => set('firmaRazonSocial', e.target.value)}
                    placeholder="Nombre de la firma *" className={inp} />
                  <p className="text-xs font-medium text-gray-500">Registro Público</p>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={form.firmaFicha} onChange={e => set('firmaFicha', e.target.value)} placeholder="Ficha" className={inp} />
                    <input value={form.firmaFolio} onChange={e => set('firmaFolio', e.target.value)} placeholder="Folio" className={inp} />
                    <input value={form.firmaProvincia} onChange={e => set('firmaProvincia', e.target.value)} placeholder="Provincia" className={inp} />
                  </div>
                  <p className="text-xs font-medium text-gray-500">Abogado responsable</p>
                  <div className="grid grid-cols-3 gap-2">
                    <input value={form.firmaRepNombre} onChange={e => set('firmaRepNombre', e.target.value)}
                      placeholder="Nombre" className={inp} />
                    <input value={form.firmaRepCedula} onChange={e => set('firmaRepCedula', e.target.value)}
                      placeholder="Cédula" className={inp} />
                    <input value={form.firmaRepIdoneidad} onChange={e => set('firmaRepIdoneidad', e.target.value)}
                      placeholder="Idoneidad" className={inp} />
                  </div>
                  <p className="text-xs font-medium text-gray-500">Contacto y dirección</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.firmaTelefono} onChange={e => set('firmaTelefono', e.target.value)}
                      placeholder="Teléfono" className={inp} />
                    <input value={form.firmaEmail} onChange={e => set('firmaEmail', e.target.value)}
                      placeholder="Correo" className={inp} />
                  </div>
                  <input value={form.firmaDireccion} onChange={e => set('firmaDireccion', e.target.value)}
                    placeholder="Dirección / domicilio de la firma" className={inp} />
                </div>
              )}
            </div>

            {/* ── Objeto del poder ────────────────────────────────────── */}
            <div>
              <SeccionLabel>Objeto del poder</SeccionLabel>
              <textarea value={form.objetoPoder} onChange={e => set('objetoPoder', e.target.value)} rows={3}
                placeholder="Ej: presente demanda ordinaria en contra de… / tramite la solicitud de residencia permanente… / compre el inmueble finca N°…"
                className={`${inp} resize-none`} />
            </div>

            {/* ── Contraparte (si contencioso) ────────────────────────── */}
            {form.esContencioso && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <SeccionLabel>Contraparte</SeccionLabel>
                  <Toggle label="Persona jurídica" checked={form.ctEsPJ} onChange={v => set('ctEsPJ', v)} />
                </div>

                {!form.ctEsPJ ? (
                  <div className="space-y-3">
                    <input value={form.ctNombre} onChange={e => set('ctNombre', e.target.value)}
                      placeholder="Nombre completo" className={inp} />
                    <div className="grid grid-cols-3 gap-2">
                      <select value={form.ctDocTipo} onChange={e => set('ctDocTipo', e.target.value)} className={inp}>
                        <option value="cedula">Cédula</option>
                        <option value="pasaporte">Pasaporte</option>
                      </select>
                      <input value={form.ctDocTipo === 'cedula' ? form.ctCedula : form.ctPasaporte}
                        onChange={e => set(form.ctDocTipo === 'cedula' ? 'ctCedula' : 'ctPasaporte', e.target.value)}
                        placeholder="Número" className={`col-span-2 ${inp}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={form.ctNacionalidad} onChange={e => set('ctNacionalidad', e.target.value)}
                        placeholder="Nacionalidad" className={inp} />
                      <select value={form.ctEstadoCivil} onChange={e => set('ctEstadoCivil', e.target.value)} className={inp}>
                        <option value="">Estado civil...</option>
                        {['soltero(a)', 'casado(a)', 'divorciado(a)', 'viudo(a)', 'unido(a) en matrimonio de hecho'].map(v =>
                          <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                      </select>
                    </div>
                    <input value={form.ctProfesion} onChange={e => set('ctProfesion', e.target.value)}
                      placeholder="Profesión u oficio" className={inp} />
                    <p className="text-xs font-medium text-gray-500">Domicilio conocido</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={form.ctDomNumero} onChange={e => set('ctDomNumero', e.target.value)}
                        placeholder="N° casa/apto/oficina" className={inp} />
                      <input value={form.ctDomBarrio} onChange={e => set('ctDomBarrio', e.target.value)}
                        placeholder="Barriada / Urbanización" className={inp} />
                      <input value={form.ctDomCorregimiento} onChange={e => set('ctDomCorregimiento', e.target.value)}
                        placeholder="Corregimiento" className={inp} />
                      <input value={form.ctDomDistrito} onChange={e => set('ctDomDistrito', e.target.value)}
                        placeholder="Distrito" className={inp} />
                      <input value={form.ctDomProvincia} onChange={e => set('ctDomProvincia', e.target.value)}
                        placeholder="Provincia" className={inp} />
                      <input value={form.ctDomPais} onChange={e => set('ctDomPais', e.target.value)}
                        placeholder="País" className={inp} />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input value={form.ctPjRazonSocial} onChange={e => set('ctPjRazonSocial', e.target.value)}
                        placeholder="Razón social" className={inp} />
                      <select value={form.ctPjTipoSociedad} onChange={e => set('ctPjTipoSociedad', e.target.value)} className={inp}>
                        {['Sociedad Anónima', 'S.R.L.', 'Fundación de Interés Privado', 'Asociación Civil', 'Cooperativa'].map(v =>
                          <option key={v}>{v}</option>)}
                      </select>
                    </div>
                    <p className="text-xs font-medium text-gray-500">Datos del Registro Público</p>
                    <div className="grid grid-cols-4 gap-2">
                      <input value={form.ctPjFicha} onChange={e => set('ctPjFicha', e.target.value)} placeholder="Ficha" className={inp} />
                      <input value={form.ctPjTomo} onChange={e => set('ctPjTomo', e.target.value)} placeholder="Tomo" className={inp} />
                      <input value={form.ctPjFolio} onChange={e => set('ctPjFolio', e.target.value)} placeholder="Folio" className={inp} />
                      <input value={form.ctPjProvincia} onChange={e => set('ctPjProvincia', e.target.value)} placeholder="Provincia" className={inp} />
                    </div>
                    <p className="text-xs font-medium text-gray-500">Representante legal</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={form.ctPjRepNombre} onChange={e => set('ctPjRepNombre', e.target.value)}
                        placeholder="Nombre del rep. legal" className={inp} />
                      <input value={form.ctPjRepCargo} onChange={e => set('ctPjRepCargo', e.target.value)}
                        placeholder="Cargo" className={inp} />
                    </div>
                    <input value={form.ctPjRepCedula} onChange={e => set('ctPjRepCedula', e.target.value)}
                      placeholder="Cédula del representante" className={inp} />
                    <p className="text-xs font-medium text-gray-500">Domicilio conocido</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={form.ctDomNumero} onChange={e => set('ctDomNumero', e.target.value)} placeholder="N° oficina" className={inp} />
                      <input value={form.ctDomBarrio} onChange={e => set('ctDomBarrio', e.target.value)} placeholder="Barriada / Edificio" className={inp} />
                      <input value={form.ctDomCorregimiento} onChange={e => set('ctDomCorregimiento', e.target.value)} placeholder="Corregimiento" className={inp} />
                      <input value={form.ctDomDistrito} onChange={e => set('ctDomDistrito', e.target.value)} placeholder="Distrito" className={inp} />
                      <input value={form.ctDomProvincia} onChange={e => set('ctDomProvincia', e.target.value)} placeholder="Provincia" className={inp} />
                      <input value={form.ctDomPais} onChange={e => set('ctDomPais', e.target.value)} placeholder="País" className={inp} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Fecha y lugar ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Ciudad de firma">
                <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)} className={inp} />
              </Campo>
              <Campo label="Fecha del documento">
                <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} className={inp} />
              </Campo>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancelar
              </button>
              <button type="submit" disabled={!canGenerate}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                <FileText className="w-4 h-4" /> Generar Documento
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

              {/* Cabecera del documento */}
              {(docData.tipoProceso || docData.partes) && (
                <div className="flex justify-between items-start bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Tipo de proceso</p>
                    <input value={docData.tipoProceso} onChange={e => setDocData(d => ({ ...d, tipoProceso: e.target.value }))}
                      className="text-xs font-bold text-gray-800 uppercase bg-transparent border-0 outline-none w-full" />
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Partes</p>
                    <textarea value={docData.partes} onChange={e => setDocData(d => ({ ...d, partes: e.target.value }))}
                      rows={3} className="text-xs text-gray-800 text-right bg-transparent border-0 outline-none resize-none w-40" />
                  </div>
                </div>
              )}

              {docData.autoridadDirigida && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Autoridad dirigida</p>
                  <input value={docData.autoridadDirigida} onChange={e => setDocData(d => ({ ...d, autoridadDirigida: e.target.value }))}
                    className={inp} />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {tipoSeleccionado?.label}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">Editable antes de exportar</span>
                </div>
                <textarea value={docData.cuerpo} onChange={e => setDocData(d => ({ ...d, cuerpo: e.target.value }))}
                  className="w-full h-[360px] font-mono text-xs border border-gray-300 rounded-xl p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed" />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0 flex-wrap">
              <button onClick={() => setPaso(1)} className="px-4 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                ← Volver
              </button>
              <div className="flex-1" />
              <button onClick={() => imprimirDocumento(docData)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                <Printer className="w-4 h-4" /> Imprimir / PDF
              </button>
              <button onClick={() => exportarWord(docData)}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                <Download className="w-4 h-4" /> Descargar Word
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
