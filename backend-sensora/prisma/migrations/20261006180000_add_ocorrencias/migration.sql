-- CreateEnum
CREATE TYPE "TipoOcorrencia" AS ENUM ('CHECKOUT', 'PAGAMENTO', 'REEMBOLSO', 'DEVOLUCAO');

-- CreateEnum
CREATE TYPE "ResultadoOcorrencia" AS ENUM ('SUCESSO', 'FALHA', 'ALERTA', 'INFO');

-- CreateTable
CREATE TABLE "Ocorrencia" (
    "id" SERIAL NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" "TipoOcorrencia" NOT NULL,
    "resultado" "ResultadoOcorrencia" NOT NULL,
    "codigo" TEXT NOT NULL,
    "etapa" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "usuarioId" INTEGER,
    "pedidoId" INTEGER,
    "devolucaoId" INTEGER,
    "pedidoNumero" TEXT,
    "valor" DECIMAL(10,2),
    "gateway" TEXT,
    "referenciaExterna" TEXT,
    "detalhes" JSONB,
    "chaveIdempotencia" TEXT,

    CONSTRAINT "Ocorrencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ocorrencia_chaveIdempotencia_key" ON "Ocorrencia"("chaveIdempotencia");

-- CreateIndex
CREATE INDEX "Ocorrencia_criadoEm_idx" ON "Ocorrencia"("criadoEm" DESC);

-- CreateIndex
CREATE INDEX "Ocorrencia_tipo_criadoEm_idx" ON "Ocorrencia"("tipo", "criadoEm" DESC);

-- CreateIndex
CREATE INDEX "Ocorrencia_resultado_criadoEm_idx" ON "Ocorrencia"("resultado", "criadoEm" DESC);

-- CreateIndex
CREATE INDEX "Ocorrencia_usuarioId_idx" ON "Ocorrencia"("usuarioId");

-- CreateIndex
CREATE INDEX "Ocorrencia_pedidoId_idx" ON "Ocorrencia"("pedidoId");

-- CreateIndex
CREATE INDEX "Ocorrencia_devolucaoId_idx" ON "Ocorrencia"("devolucaoId");

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ocorrencia" ADD CONSTRAINT "Ocorrencia_devolucaoId_fkey" FOREIGN KEY ("devolucaoId") REFERENCES "Devolucao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

