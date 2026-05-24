-- CreateEnum
CREATE TYPE "PlanFirma" AS ENUM ('SOLO', 'FIRMA', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "RolAbogado" AS ENUM ('SOCIO', 'ASOCIADO', 'PASANTE', 'ADMIN');

-- CreateEnum
CREATE TYPE "TipoCliente" AS ENUM ('PERSONA_NATURAL', 'JURIDICA');

-- CreateEnum
CREATE TYPE "TipoCaso" AS ENUM ('CIVIL', 'PENAL', 'LABORAL', 'COMERCIAL', 'ADMINISTRATIVO', 'FAMILIAR', 'MARITIMO', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoCaso" AS ENUM ('ACTIVO', 'SUSPENDIDO', 'CERRADO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "EstadoAudiencia" AS ENUM ('PENDIENTE', 'REALIZADA', 'SUSPENDIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "EstadoTermino" AS ENUM ('PENDIENTE', 'COMPLETADO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "PrioridadTermino" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "EstadoTarea" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA');

-- CreateEnum
CREATE TYPE "PrioridadTarea" AS ENUM ('ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "TipoHonorario" AS ENUM ('HORA', 'FIJO', 'CONTINGENCIA', 'MIXTO');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('BORRADOR', 'ENVIADA', 'PAGADA', 'VENCIDA', 'ANULADA');

-- CreateEnum
CREATE TYPE "TipoPoder" AS ENUM ('GENERAL', 'ESPECIAL', 'JUDICIAL');

-- CreateEnum
CREATE TYPE "EstadoTimer" AS ENUM ('CORRIENDO', 'PAUSADO');

-- CreateEnum
CREATE TYPE "TipoComunicacion" AS ENUM ('EMAIL', 'LLAMADA', 'REUNION', 'WHATSAPP', 'CARTA');

-- CreateEnum
CREATE TYPE "TipoGasto" AS ENUM ('TASA_JUDICIAL', 'NOTARIA', 'TRANSPORTE', 'REGISTRO', 'OTRO');

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "abogadoId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firmas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ruc" TEXT NOT NULL,
    "direccion" TEXT,
    "telefono" TEXT,
    "email" TEXT NOT NULL,
    "logo" TEXT,
    "especialidades" TEXT[],
    "plan" "PlanFirma" NOT NULL DEFAULT 'SOLO',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abogados" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "numeroIdoneidad" TEXT NOT NULL,
    "especialidad" TEXT,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" "RolAbogado" NOT NULL DEFAULT 'ASOCIADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abogados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "cedula" TEXT,
    "ruc" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "tipo" "TipoCliente" NOT NULL DEFAULT 'PERSONA_NATURAL',
    "origen" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casos" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "abogadoId" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "TipoCaso" NOT NULL DEFAULT 'CIVIL',
    "juzgado" TEXT,
    "juez" TEXT,
    "contraparte" TEXT,
    "estado" "EstadoCaso" NOT NULL DEFAULT 'ACTIVO',
    "fechaApertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaCierre" TIMESTAMP(3),
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "casos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casos_abogados" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "abogadoId" TEXT NOT NULL,
    "rol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casos_abogados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casos_historial" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "estadoAntes" "EstadoCaso",
    "estadoDespues" "EstadoCaso" NOT NULL,
    "nota" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abogadoId" TEXT,

    CONSTRAINT "casos_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audiencias" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "hora" TEXT,
    "juzgado" TEXT,
    "sala" TEXT,
    "tipo" TEXT,
    "resultado" TEXT,
    "notas" TEXT,
    "estado" "EstadoAudiencia" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audiencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terminos_procesales" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaVence" TIMESTAMP(3) NOT NULL,
    "diasAlerta" INTEGER NOT NULL DEFAULT 3,
    "estado" "EstadoTermino" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "PrioridadTermino" NOT NULL DEFAULT 'MEDIA',
    "completadoEn" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "terminos_procesales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT,
    "archivo" TEXT NOT NULL,
    "mimeType" TEXT,
    "tamanoBytes" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fechaSubida" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subidoPorId" TEXT,
    "confidencial" BOOLEAN NOT NULL DEFAULT false,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "abogadoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "fechaLimite" TIMESTAMP(3),
    "estado" "EstadoTarea" NOT NULL DEFAULT 'PENDIENTE',
    "prioridad" "PrioridadTarea" NOT NULL DEFAULT 'MEDIA',
    "completadaEn" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "honorarios_config" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "tipo" "TipoHonorario" NOT NULL DEFAULT 'HORA',
    "tarifaHora" DECIMAL(10,2),
    "montoFijo" DECIMAL(10,2),
    "porcentajeExito" DECIMAL(5,2),
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "honorarios_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_horas" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "abogadoId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horas" DECIMAL(5,2) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "facturable" BOOLEAN NOT NULL DEFAULT true,
    "facturaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registros_horas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" TEXT NOT NULL,
    "firmaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "casoId" TEXT,
    "numero" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'BORRADOR',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vence" TIMESTAMP(3),
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poderes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "casoId" TEXT,
    "tipo" "TipoPoder" NOT NULL DEFAULT 'ESPECIAL',
    "fechaOtorgamiento" TIMESTAMP(3) NOT NULL,
    "fechaVence" TIMESTAMP(3),
    "notaria" TEXT,
    "tomo" TEXT,
    "folio" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poderes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicaciones" (
    "id" TEXT NOT NULL,
    "casoId" TEXT,
    "clienteId" TEXT NOT NULL,
    "abogadoId" TEXT NOT NULL,
    "tipo" "TipoComunicacion" NOT NULL DEFAULT 'EMAIL',
    "descripcion" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comunicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timers" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "abogadoId" TEXT NOT NULL,
    "descripcion" TEXT,
    "iniciadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausadoEn" TIMESTAMP(3),
    "duracionAcumulada" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoTimer" NOT NULL DEFAULT 'CORRIENDO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos" (
    "id" TEXT NOT NULL,
    "casoId" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "tipo" "TipoGasto" NOT NULL DEFAULT 'OTRO',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reembolsable" BOOLEAN NOT NULL DEFAULT false,
    "reembolsado" BOOLEAN NOT NULL DEFAULT false,
    "comprobante" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "firmas_ruc_key" ON "firmas"("ruc");

-- CreateIndex
CREATE UNIQUE INDEX "firmas_email_key" ON "firmas"("email");

-- CreateIndex
CREATE UNIQUE INDEX "abogados_numeroIdoneidad_key" ON "abogados"("numeroIdoneidad");

-- CreateIndex
CREATE UNIQUE INDEX "abogados_email_key" ON "abogados"("email");

-- CreateIndex
CREATE UNIQUE INDEX "casos_firmaId_numero_key" ON "casos"("firmaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "casos_abogados_casoId_abogadoId_key" ON "casos_abogados"("casoId", "abogadoId");

-- CreateIndex
CREATE UNIQUE INDEX "honorarios_config_casoId_key" ON "honorarios_config"("casoId");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_firmaId_numero_key" ON "facturas"("firmaId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "timers_casoId_abogadoId_key" ON "timers"("casoId", "abogadoId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "abogados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abogados" ADD CONSTRAINT "abogados_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "firmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "firmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos" ADD CONSTRAINT "casos_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "firmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos" ADD CONSTRAINT "casos_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos" ADD CONSTRAINT "casos_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "abogados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos_abogados" ADD CONSTRAINT "casos_abogados_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos_abogados" ADD CONSTRAINT "casos_abogados_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "abogados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos_historial" ADD CONSTRAINT "casos_historial_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audiencias" ADD CONSTRAINT "audiencias_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "terminos_procesales" ADD CONSTRAINT "terminos_procesales_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_subidoPorId_fkey" FOREIGN KEY ("subidoPorId") REFERENCES "abogados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "abogados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "honorarios_config" ADD CONSTRAINT "honorarios_config_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_horas" ADD CONSTRAINT "registros_horas_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_horas" ADD CONSTRAINT "registros_horas_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "abogados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_firmaId_fkey" FOREIGN KEY ("firmaId") REFERENCES "firmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poderes" ADD CONSTRAINT "poderes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poderes" ADD CONSTRAINT "poderes_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicaciones" ADD CONSTRAINT "comunicaciones_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicaciones" ADD CONSTRAINT "comunicaciones_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicaciones" ADD CONSTRAINT "comunicaciones_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "abogados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timers" ADD CONSTRAINT "timers_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timers" ADD CONSTRAINT "timers_abogadoId_fkey" FOREIGN KEY ("abogadoId") REFERENCES "abogados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_casoId_fkey" FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
