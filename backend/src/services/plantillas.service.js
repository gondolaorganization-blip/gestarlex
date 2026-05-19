// Plantillas de escritos jurídicos panameños — referencia Ley 402 de 2023

const PLANTILLAS = [
  {
    id: 'demanda-civil',
    nombre: 'Demanda Civil',
    tipo: 'CIVIL',
    descripcion: 'Demanda ordinaria según Código Procesal Civil (Ley 402 de 2023)',
    variables: ['demandante', 'demandado', 'juzgado', 'pretension', 'hechos', 'fundamentos', 'abogado', 'idoneidad'],
    contenido: `JUZGADO {{juzgado}} DE CIRCUITO CIVIL

DEMANDA ORDINARIA

Señor(a) Juez(a):

{{abogado}}, abogado(a) en ejercicio, con idoneidad No. {{idoneidad}}, actuando en nombre y representación de {{demandante}}, quien es mayor de edad, con cédula de identidad personal No. ___, con domicilio en la ciudad de Panamá, mediante el presente escrito y con el debido respeto expone:

I. PARTE DEMANDADA
La presente demanda se dirige contra {{demandado}}.

II. HECHOS
{{hechos}}

III. FUNDAMENTOS DE DERECHO
{{fundamentos}}

IV. PRETENSIONES
{{pretension}}

V. MEDIOS DE PRUEBA
Se aportarán en la audiencia inicial los medios de prueba pertinentes conforme al artículo 394 de la Ley 402 de 2023.

Con el acatamiento debido,

{{abogado}}
Idoneidad No. {{idoneidad}}
`,
  },
  {
    id: 'contestacion-demanda',
    nombre: 'Contestación de Demanda',
    tipo: 'CIVIL',
    descripcion: 'Contestación dentro del plazo legal — Art. 548 Ley 402 de 2023',
    variables: ['demandado', 'demandante', 'juzgado', 'expediente', 'hechos', 'excepciones', 'abogado', 'idoneidad'],
    contenido: `JUZGADO {{juzgado}} DE CIRCUITO CIVIL

EXPEDIENTE No. {{expediente}}

CONTESTACIÓN DE DEMANDA

Señor(a) Juez(a):

{{abogado}}, abogado(a) en ejercicio con idoneidad No. {{idoneidad}}, actuando en nombre y representación de {{demandado}}, en tiempo oportuno comparezco a contestar la demanda incoada en mi contra por {{demandante}}.

I. HECHOS QUE SE ACEPTAN O RECHAZAN
{{hechos}}

II. EXCEPCIONES
{{excepciones}}

III. MEDIOS DE PRUEBA
Los pertinentes que se presentarán en audiencia.

Respetuosamente,

{{abogado}}
Idoneidad No. {{idoneidad}}
`,
  },
  {
    id: 'poder-especial-judicial',
    nombre: 'Poder Especial Judicial',
    tipo: 'PODER',
    descripcion: 'Poder especial para representación judicial — Código Civil de Panamá',
    variables: ['poderdante', 'cedulaPoderdante', 'abogado', 'idoneidad', 'juzgado', 'materia', 'notaria', 'ciudad'],
    contenido: `PODER ESPECIAL JUDICIAL

En la ciudad de {{ciudad}}, República de Panamá, ante mí, Notario(a) Público(a) de la República de Panamá, compareció {{poderdante}}, varón/mujer, mayor de edad, con cédula de identidad personal No. {{cedulaPoderdante}}, de este domicilio, a quien conozco personalmente, y dijo:

Que por medio del presente instrumento otorga PODER ESPECIAL a favor del Licenciado(a) {{abogado}}, abogado(a) en ejercicio con idoneidad No. {{idoneidad}}, para que en su nombre y representación lo(a) represente ante el {{juzgado}} y cualesquiera otros juzgados, tribunales y autoridades judiciales de la República de Panamá, en todos los asuntos relativos a {{materia}}.

El presente poder es para representarlo(a) en todas las instancias del proceso, pudiendo el apoderado realizar todos los actos propios del mandato judicial, incluyendo interponer recursos, contestar demandas, presentar pruebas, y en general realizar todos los actos procesales necesarios para la defensa de los intereses del poderdante.

LEÍDO por mí el presente instrumento al compareciente, lo encontró conforme, lo aprueba y lo firma.

_______________________          _______________________
{{poderdante}}                    Notario(a) Público(a)
C.I.P. {{cedulaPoderdante}}
`,
  },
  {
    id: 'recurso-apelacion',
    nombre: 'Recurso de Apelación',
    tipo: 'CIVIL',
    descripcion: 'Recurso de apelación — Art. 1071 y ss. Ley 402 de 2023',
    variables: ['apelante', 'juzgado', 'expediente', 'resolucioApelada', 'agravios', 'abogado', 'idoneidad'],
    contenido: `JUZGADO {{juzgado}} DE CIRCUITO CIVIL

EXPEDIENTE No. {{expediente}}

RECURSO DE APELACIÓN

Señor(a) Juez(a):

{{abogado}}, apoderado(a) judicial de {{apelante}}, dentro del término legal, interpone RECURSO DE APELACIÓN contra la resolución de fecha {{resolucioApelada}}, por los siguientes agravios:

AGRAVIOS
{{agravios}}

Por lo expuesto, solicito respetuosamente que se admita el presente recurso y se eleve a conocimiento del Superior.

{{abogado}}
Idoneidad No. {{idoneidad}}
`,
  },
  {
    id: 'demanda-laboral',
    nombre: 'Demanda Laboral',
    tipo: 'LABORAL',
    descripcion: 'Demanda ante juzgado de trabajo — Código de Trabajo de Panamá',
    variables: ['trabajador', 'cedula', 'empleador', 'juzgado', 'cargo', 'salario', 'fechaIngreso', 'fechaDespido', 'pretensiones', 'abogado', 'idoneidad'],
    contenido: `JUZGADO {{juzgado}} DE TRABAJO

DEMANDA LABORAL

Señor(a) Juez(a):

{{abogado}}, abogado(a) con idoneidad No. {{idoneidad}}, actuando en nombre de {{trabajador}}, con C.I.P. No. {{cedula}}, expone:

I. PARTES
Demandante: {{trabajador}}
Demandado: {{empleador}}

II. RELACIÓN LABORAL
Cargo: {{cargo}}
Salario mensual: B/. {{salario}}
Fecha de ingreso: {{fechaIngreso}}
Fecha de terminación: {{fechaDespido}}

III. PRETENSIONES
{{pretensiones}}

IV. FUNDAMENTO LEGAL
Código de Trabajo de la República de Panamá y sus modificaciones.

{{abogado}}
Idoneidad No. {{idoneidad}}
`,
  },
  {
    id: 'nota-cobro',
    nombre: 'Nota de Cobro de Honorarios',
    tipo: 'HONORARIOS',
    descripcion: 'Nota de cobro referenciando Acuerdo 49 de 2001 del Órgano Judicial',
    variables: ['firma', 'cliente', 'caso', 'monto', 'concepto', 'cuentaBancaria', 'fecha'],
    contenido: `{{firma}}

Ciudad de Panamá, {{fecha}}

Señor(a):
{{cliente}}

Presente.

Estimado(a) cliente:

Por medio de la presente, le remitimos nota de cobro por concepto de honorarios profesionales correspondientes al caso: {{caso}}.

DETALLE DE HONORARIOS:
{{concepto}}

TOTAL A PAGAR: B/. {{monto}}

Los honorarios han sido calculados conforme a los parámetros establecidos en el Acuerdo No. 49 de 9 de agosto de 2001 del Órgano Judicial.

Para realizar su pago, puede hacer transferencia a:
{{cuentaBancaria}}

Quedamos a su disposición para cualquier consulta.

Atentamente,
{{firma}}
`,
  },
];

export const listar = () =>
  PLANTILLAS.map(({ id, nombre, tipo, descripcion, variables }) => ({
    id, nombre, tipo, descripcion, variables,
  }));

export const obtener = (id) => {
  const plantilla = PLANTILLAS.find((p) => p.id === id);
  if (!plantilla) return null;
  return plantilla;
};

export const renderizar = (id, variables = {}) => {
  const plantilla = obtener(id);
  if (!plantilla) return null;

  let contenido = plantilla.contenido;
  for (const [key, value] of Object.entries(variables)) {
    contenido = contenido.replaceAll(`{{${key}}}`, value || `[${key}]`);
  }
  return { nombre: plantilla.nombre, contenido };
};
