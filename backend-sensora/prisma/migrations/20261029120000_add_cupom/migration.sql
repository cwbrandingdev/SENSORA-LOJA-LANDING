-- CreateEnum
CREATE TYPE "TipoDescontoCupom" AS ENUM ('PERCENTUAL', 'FIXO');

-- CreateEnum
CREATE TYPE "PublicoCupom" AS ENUM ('TODOS', 'NOVOS_CLIENTES', 'USUARIOS');

-- CreateTable
CREATE TABLE "Cupom" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "tipoDesconto" "TipoDescontoCupom" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "publico" "PublicoCupom" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "mostrarNoTopo" BOOLEAN NOT NULL DEFAULT true,
    "valorMinimo" DECIMAL(10,2),
    "limiteUsos" INTEGER,
    "inicioEm" TIMESTAMP(3),
    "fimEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cupom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CupomUsuario" (
    "cupomId" INTEGER NOT NULL,
    "usuarioId" INTEGER NOT NULL,

    CONSTRAINT "CupomUsuario_pkey" PRIMARY KEY ("cupomId","usuarioId")
);

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN "cupomId" INTEGER,
ADD COLUMN "cupomCodigo" TEXT,
ADD COLUMN "desconto" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Cupom_codigo_key" ON "Cupom"("codigo");

-- CreateIndex
CREATE INDEX "Cupom_ativo_mostrarNoTopo_idx" ON "Cupom"("ativo", "mostrarNoTopo");

-- CreateIndex
CREATE INDEX "Pedido_cupomId_idx" ON "Pedido"("cupomId");

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupomUsuario" ADD CONSTRAINT "CupomUsuario_cupomId_fkey" FOREIGN KEY ("cupomId") REFERENCES "Cupom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CupomUsuario" ADD CONSTRAINT "CupomUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
