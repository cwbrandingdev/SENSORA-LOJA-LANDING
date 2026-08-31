-- AlterTable
ALTER TABLE "Produto" ADD COLUMN "imagemUrl" TEXT,
ADD COLUMN "aroma" TEXT,
ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "categoriaId" INTEGER;

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN "stripeSessionId" TEXT,
ADD COLUMN "clienteEmail" TEXT,
ADD COLUMN "clienteNome" TEXT,
ADD COLUMN "usuarioId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_stripeSessionId_key" ON "Pedido"("stripeSessionId");

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
