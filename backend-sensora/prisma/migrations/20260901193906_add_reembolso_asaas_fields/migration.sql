-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusPedido" ADD VALUE 'REEMBOLSO_SOLICITADO';
ALTER TYPE "StatusPedido" ADD VALUE 'REEMBOLSADO';

-- AlterTable
ALTER TABLE "ItemPedido" ADD COLUMN     "estoqueRestaurado" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "asaasPaymentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_asaasPaymentId_key" ON "Pedido"("asaasPaymentId");
