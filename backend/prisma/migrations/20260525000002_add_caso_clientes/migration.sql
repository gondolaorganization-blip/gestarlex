-- CreateTable: múltiples clientes por caso
CREATE TABLE "casos_clientes" (
    "id"        TEXT NOT NULL,
    "casoId"    TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "rol"       TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casos_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "casos_clientes_casoId_clienteId_key" ON "casos_clientes"("casoId", "clienteId");

-- AddForeignKey
ALTER TABLE "casos_clientes"
  ADD CONSTRAINT "casos_clientes_casoId_fkey"
  FOREIGN KEY ("casoId") REFERENCES "casos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casos_clientes"
  ADD CONSTRAINT "casos_clientes_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
