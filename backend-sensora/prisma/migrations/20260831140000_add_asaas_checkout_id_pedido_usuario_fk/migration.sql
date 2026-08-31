-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "asaasCheckoutId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_asaasCheckoutId_key" ON "Pedido"("asaasCheckoutId");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
