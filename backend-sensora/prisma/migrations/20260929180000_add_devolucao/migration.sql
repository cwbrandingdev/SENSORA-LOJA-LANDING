-- CreateEnum
CREATE TYPE "StatusDevolucao" AS ENUM ('SOLICITADA', 'EM_ANALISE', 'APROVADA', 'RECUSADA', 'AGUARDANDO_ENVIO', 'ENVIADA', 'RECEBIDA', 'EM_CONFERENCIA', 'CONCLUIDA', 'CANCELADA');

-- CreateTable
CREATE TABLE "Devolucao" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "motivo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" "StatusDevolucao" NOT NULL DEFAULT 'SOLICITADA',
    "solicitadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "analisadaEm" TIMESTAMP(3),
    "observacaoAnalise" TEXT,
    "analisadoPorId" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Devolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDevolucao" (
    "id" SERIAL NOT NULL,
    "devolucaoId" INTEGER NOT NULL,
    "itemPedidoId" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitario" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ItemDevolucao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Devolucao_pedidoId_idx" ON "Devolucao"("pedidoId");

-- CreateIndex
CREATE INDEX "Devolucao_usuarioId_idx" ON "Devolucao"("usuarioId");

-- CreateIndex
CREATE INDEX "Devolucao_status_idx" ON "Devolucao"("status");

-- CreateIndex
CREATE INDEX "Devolucao_solicitadaEm_idx" ON "Devolucao"("solicitadaEm");

-- CreateIndex
CREATE INDEX "ItemDevolucao_itemPedidoId_idx" ON "ItemDevolucao"("itemPedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemDevolucao_devolucaoId_itemPedidoId_key" ON "ItemDevolucao"("devolucaoId", "itemPedidoId");

-- AddForeignKey
ALTER TABLE "Devolucao" ADD CONSTRAINT "Devolucao_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucao" ADD CONSTRAINT "Devolucao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Devolucao" ADD CONSTRAINT "Devolucao_analisadoPorId_fkey" FOREIGN KEY ("analisadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDevolucao" ADD CONSTRAINT "ItemDevolucao_devolucaoId_fkey" FOREIGN KEY ("devolucaoId") REFERENCES "Devolucao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDevolucao" ADD CONSTRAINT "ItemDevolucao_itemPedidoId_fkey" FOREIGN KEY ("itemPedidoId") REFERENCES "ItemPedido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
