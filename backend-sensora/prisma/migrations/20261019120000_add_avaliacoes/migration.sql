-- CreateEnum
CREATE TYPE "StatusAvaliacao" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA');

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "lembreteAvaliacaoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Avaliacao" (
    "id" SERIAL NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "nomeExibicao" TEXT NOT NULL,
    "nota" INTEGER NOT NULL,
    "comentario" TEXT,
    "status" "StatusAvaliacao" NOT NULL DEFAULT 'PENDENTE',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Avaliacao_produtoId_status_idx" ON "Avaliacao"("produtoId", "status");

-- CreateIndex
CREATE INDEX "Avaliacao_status_criadaEm_idx" ON "Avaliacao"("status", "criadaEm" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_pedidoId_produtoId_key" ON "Avaliacao"("pedidoId", "produtoId");

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

