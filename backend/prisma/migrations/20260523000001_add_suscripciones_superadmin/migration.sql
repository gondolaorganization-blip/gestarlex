-- CreateEnum
CREATE TYPE "EstadoSuscripcion" AS ENUM ('TRIAL', 'ACTIVO', 'SUSPENDIDO', 'VENCIDO');

-- AlterTable: campos de suscripción en firmas
ALTER TABLE "firmas"
  ADD COLUMN "suscripcionEstado"    "EstadoSuscripcion" NOT NULL DEFAULT 'TRIAL',
  ADD COLUMN "trialEndsAt"          TIMESTAMP(3),
  ADD COLUMN "suscripcionVenceEn"   TIMESTAMP(3),
  ADD COLUMN "accessManual"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "paypalSubscriptionId" TEXT,
  ADD COLUMN "aiConsultasMes"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "aiConsultasResetEn"   TIMESTAMP(3);

-- CreateIndex: paypalSubscriptionId único
CREATE UNIQUE INDEX "firmas_paypalSubscriptionId_key" ON "firmas"("paypalSubscriptionId");

-- CreateTable: super_admins
CREATE TABLE "super_admins" (
    "id"           TEXT NOT NULL,
    "nombre"       TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "activo"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "super_admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "super_admins_email_key" ON "super_admins"("email");

-- CreateTable: suscripcion_eventos
CREATE TABLE "suscripcion_eventos" (
    "id"        TEXT NOT NULL,
    "firmaId"   TEXT NOT NULL,
    "evento"    TEXT NOT NULL,
    "detalle"   JSONB,
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suscripcion_eventos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "suscripcion_eventos"
  ADD CONSTRAINT "suscripcion_eventos_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "firmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: email_logs
CREATE TABLE "email_logs" (
    "id"           TEXT NOT NULL,
    "firmaId"      TEXT NOT NULL,
    "casoId"       TEXT,
    "tipo"         TEXT NOT NULL,
    "asunto"       TEXT NOT NULL,
    "destinatario" TEXT NOT NULL,
    "enviado"      BOOLEAN NOT NULL DEFAULT false,
    "fechaEnvio"   TIMESTAMP(3),
    "error"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "email_logs"
  ADD CONSTRAINT "email_logs_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "firmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs"
  ADD CONSTRAINT "email_logs_casoId_fkey"
  FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
