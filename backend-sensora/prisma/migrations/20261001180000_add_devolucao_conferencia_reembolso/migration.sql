-- AlterTable
ALTER TABLE "Devolucao" ADD COLUMN     "asaasRefundId" TEXT,
ADD COLUMN     "conferidaEm" TIMESTAMP(3),
ADD COLUMN     "conferidoPorId" INTEGER,
ADD COLUMN     "estoqueRestauradoEm" TIMESTAMP(3),
ADD COLUMN     "observacaoConferencia" TEXT,
ADD COLUMN     "reembolsadaEm" TIMESTAMP(3),
ADD COLUMN     "reembolsoValor" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ItemDevolucao" ADD COLUMN     "quantidadeAceita" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Devolucao_asaasRefundId_key" ON "Devolucao"("asaasRefundId");

-- AddForeignKey
ALTER TABLE "Devolucao" ADD CONSTRAINT "Devolucao_conferidoPorId_fkey" FOREIGN KEY ("conferidoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

