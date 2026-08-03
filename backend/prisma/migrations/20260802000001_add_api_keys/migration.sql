-- CreateTable: credenciales para automatizaciones externas
CREATE TABLE "api_keys" (
    "id"          TEXT NOT NULL,
    "firmaId"     TEXT NOT NULL,
    "abogadoId"   TEXT NOT NULL,
    "nombre"      TEXT NOT NULL,
    "prefijo"     TEXT NOT NULL,
    "hash"        TEXT NOT NULL,
    "scopes"      TEXT[] DEFAULT ARRAY['casos:read']::TEXT[],
    "activa"      BOOLEAN NOT NULL DEFAULT true,
    "ultimoUsoEn" TIMESTAMP(3),
    "expiraEn"    TIMESTAMP(3),
    "revocadaEn"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hash_key" ON "api_keys"("hash");

-- CreateIndex
CREATE INDEX "api_keys_firmaId_idx" ON "api_keys"("firmaId");

-- AddForeignKey
ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_firmaId_fkey"
  FOREIGN KEY ("firmaId") REFERENCES "firmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys"
  ADD CONSTRAINT "api_keys_abogadoId_fkey"
  FOREIGN KEY ("abogadoId") REFERENCES "abogados"("id") ON DELETE CASCADE ON UPDATE CASCADE;
