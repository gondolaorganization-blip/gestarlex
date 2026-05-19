import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de GESTARLEX...');

  // SuperAdmin
  const superAdminHash = await bcrypt.hash('GestarSoft2026!', 10);
  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: 'admin@gestarsoft.com' },
    update: { passwordHash: superAdminHash },
    create: {
      nombre: 'Super Admin',
      email: 'admin@gestarsoft.com',
      passwordHash: superAdminHash,
      activo: true,
    },
  });
  console.log('SuperAdmin creado:', superAdmin.email);

  // Firma de ejemplo
  const firmaData = {
      nombre: 'Morales & Asociados',
      ruc: '155-678-23456',
      direccion: 'Edificio Plaza Regency, Piso 12, Av. Samuel Lewis, Ciudad de Panamá',
      telefono: '+507 264-5500',
      email: 'info@moralesasociados.com.pa',
      especialidades: ['CIVIL', 'COMERCIAL', 'LABORAL'],
      plan: 'FIRMA',
      suscripcionEstado: 'ACTIVO',
      accessManual: true,
      suscripcionVenceEn: new Date('2099-12-31'),
  };
  const firma = await prisma.firma.upsert({
    where: { ruc: '155-678-23456' },
    update: firmaData,
    create: firmaData,
  });

  console.log('Firma creada:', firma.nombre);

  const passwordHash = await bcrypt.hash('Gestarlex2024!', 10);

  // Abogados
  const socio = await prisma.abogado.upsert({
    where: { email: 'jmorales@moralesasociados.com.pa' },
    update: {},
    create: {
      firmaId: firma.id,
      nombre: 'Juan Carlos Morales Pérez',
      numeroIdoneidad: '12345-A',
      especialidad: 'Derecho Civil y Comercial',
      email: 'jmorales@moralesasociados.com.pa',
      telefono: '+507 6700-1234',
      rol: 'SOCIO',
      activo: true,
      passwordHash,
    },
  });

  const asociada = await prisma.abogado.upsert({
    where: { email: 'mrodriguez@moralesasociados.com.pa' },
    update: {},
    create: {
      firmaId: firma.id,
      nombre: 'María Fernanda Rodríguez',
      numeroIdoneidad: '23456-B',
      especialidad: 'Derecho Laboral',
      email: 'mrodriguez@moralesasociados.com.pa',
      telefono: '+507 6700-5678',
      rol: 'ASOCIADO',
      activo: true,
      passwordHash,
    },
  });

  const pasante = await prisma.abogado.upsert({
    where: { email: 'lsanchez@moralesasociados.com.pa' },
    update: {},
    create: {
      firmaId: firma.id,
      nombre: 'Luis Sánchez Caballero',
      numeroIdoneidad: '34567-C',
      especialidad: 'Derecho Administrativo',
      email: 'lsanchez@moralesasociados.com.pa',
      telefono: '+507 6700-9012',
      rol: 'PASANTE',
      activo: true,
      passwordHash,
    },
  });

  console.log('Abogados creados:', socio.nombre, '|', asociada.nombre, '|', pasante.nombre);

  // Clientes
  const clienteNatural = await prisma.cliente.upsert({
    where: { id: 'cliente-natural-seed' },
    update: {},
    create: {
      id: 'cliente-natural-seed',
      firmaId: firma.id,
      nombre: 'Roberto Espino González',
      cedula: '8-234-5678',
      email: 'respino@gmail.com',
      telefono: '+507 6800-1111',
      tipo: 'PERSONA_NATURAL',
      origen: 'referido',
      activo: true,
    },
  });

  const clienteJuridico = await prisma.cliente.upsert({
    where: { id: 'cliente-juridico-seed' },
    update: {},
    create: {
      id: 'cliente-juridico-seed',
      firmaId: firma.id,
      nombre: 'Constructora Ístmica, S.A.',
      ruc: '23456-1-678901 DV 12',
      email: 'legal@constructoraistmica.com.pa',
      telefono: '+507 232-4567',
      tipo: 'JURIDICA',
      origen: 'web',
      activo: true,
    },
  });

  console.log('Clientes creados:', clienteNatural.nombre, '|', clienteJuridico.nombre);

  // Caso de ejemplo
  const caso1 = await prisma.caso.upsert({
    where: {
      firmaId_numero: { firmaId: firma.id, numero: 'CV-2024-01234' },
    },
    update: {},
    create: {
      firmaId: firma.id,
      clienteId: clienteNatural.id,
      abogadoId: socio.id,
      numero: 'CV-2024-01234',
      titulo: 'Espino vs. Constructora Pacífico — Incumplimiento de Contrato',
      tipo: 'CIVIL',
      juzgado: 'Juzgado Decimocuarto de Circuito Civil del Primer Circuito Judicial',
      juez: 'Jueza Ana Beatriz Flores',
      contraparte: 'Constructora Pacífico, S.A.',
      estado: 'ACTIVO',
      fechaApertura: new Date('2024-03-15'),
      descripcion: 'Demanda por incumplimiento de contrato de construcción. El demandado no entregó la obra en el plazo acordado causando daños y perjuicios al cliente.',
    },
  });

  const caso2 = await prisma.caso.upsert({
    where: {
      firmaId_numero: { firmaId: firma.id, numero: 'LAB-2024-00567' },
    },
    update: {},
    create: {
      firmaId: firma.id,
      clienteId: clienteJuridico.id,
      abogadoId: asociada.id,
      numero: 'LAB-2024-00567',
      titulo: 'Constructora Ístmica — Defensa en demanda laboral colectiva',
      tipo: 'LABORAL',
      juzgado: 'Juzgado Segundo de Trabajo del Primer Circuito Judicial',
      juez: 'Juez Roberto Méndez',
      contraparte: 'Sindicato de Trabajadores de la Construcción',
      estado: 'ACTIVO',
      fechaApertura: new Date('2024-06-01'),
      descripcion: 'Demanda laboral colectiva por presuntas violaciones al Código de Trabajo.',
    },
  });

  console.log('Casos creados:', caso1.numero, '|', caso2.numero);

  // Audiencias
  await prisma.audiencia.createMany({
    skipDuplicates: true,
    data: [
      {
        casoId: caso1.id,
        titulo: 'Audiencia inicial — presentación de partes',
        fecha: new Date('2024-11-20'),
        hora: '09:00',
        juzgado: 'Juzgado Decimocuarto de Circuito Civil',
        tipo: 'inicial',
        estado: 'REALIZADA',
        resultado: 'Se admitió la demanda y se fijaron plazos para contestación.',
      },
      {
        casoId: caso1.id,
        titulo: 'Audiencia de pruebas',
        fecha: new Date('2025-02-15'),
        hora: '10:30',
        juzgado: 'Juzgado Decimocuarto de Circuito Civil',
        tipo: 'pruebas',
        estado: 'PENDIENTE',
      },
    ],
  });

  // Términos procesales
  await prisma.terminoProcesal.createMany({
    skipDuplicates: true,
    data: [
      {
        casoId: caso1.id,
        descripcion: 'Plazo para presentar lista de testigos y peritos — Art. 394 Ley 402',
        fechaVence: new Date('2025-01-30'),
        diasAlerta: 7,
        estado: 'PENDIENTE',
        prioridad: 'ALTA',
      },
      {
        casoId: caso2.id,
        descripcion: 'Contestación de demanda laboral — plazo 10 días hábiles',
        fechaVence: new Date('2025-01-15'),
        diasAlerta: 3,
        estado: 'COMPLETADO',
        prioridad: 'ALTA',
        completadoEn: new Date('2025-01-10'),
      },
    ],
  });

  // Configuración de honorarios
  await prisma.honorarioConfig.upsert({
    where: { casoId: caso1.id },
    update: {},
    create: {
      casoId: caso1.id,
      tipo: 'MIXTO',
      tarifaHora: 150.00,
      porcentajeExito: 15.00,
      descripcion: 'B/.150/hora + 15% del monto recuperado. Ref. Acuerdo 49 de 2001.',
    },
  });

  await prisma.honorarioConfig.upsert({
    where: { casoId: caso2.id },
    update: {},
    create: {
      casoId: caso2.id,
      tipo: 'FIJO',
      montoFijo: 5000.00,
      descripcion: 'Monto fijo acordado para defensa laboral colectiva.',
    },
  });

  // Poderes
  await prisma.poder.createMany({
    skipDuplicates: true,
    data: [
      {
        clienteId: clienteNatural.id,
        casoId: caso1.id,
        tipo: 'JUDICIAL',
        fechaOtorgamiento: new Date('2024-03-10'),
        fechaVence: new Date('2025-03-10'),
        notaria: 'Notaría Décima Tercera del Circuito de Panamá',
        tomo: '2024',
        folio: '345',
        descripcion: 'Poder especial judicial para representar al cliente en el caso CV-2024-01234',
        activo: true,
      },
      {
        clienteId: clienteJuridico.id,
        casoId: caso2.id,
        tipo: 'ESPECIAL',
        fechaOtorgamiento: new Date('2024-05-20'),
        fechaVence: new Date('2025-05-20'),
        notaria: 'Notaría Quinta del Circuito de Panamá',
        tomo: '2024',
        folio: '891',
        descripcion: 'Poder especial para representación en proceso laboral colectivo',
        activo: true,
      },
      {
        clienteId: clienteNatural.id,
        tipo: 'GENERAL',
        fechaOtorgamiento: new Date('2022-06-15'),
        fechaVence: null, // poder general sin vencimiento
        notaria: 'Notaría Décima Tercera del Circuito de Panamá',
        tomo: '2022',
        folio: '123',
        descripcion: 'Poder general para administración de bienes',
        activo: true,
      },
    ],
  });

  console.log('Poderes creados: 3');
  console.log('Seed completado exitosamente.');
  console.log('\nCredenciales de acceso (firma demo):');
  console.log('  Email: jmorales@moralesasociados.com.pa');
  console.log('  Password: Gestarlex2024!');
  console.log('\nCredenciales SuperAdmin:');
  console.log('  Email: admin@gestarsoft.com');
  console.log('  Password: SuperAdmin2024!');
}

main()
  .catch((e) => {
    console.error('Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
