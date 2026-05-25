-- AlterTable: co-destinatarios opcionales en facturas
ALTER TABLE "facturas"
  ADD COLUMN "destinatariosAdicionales" JSONB;
