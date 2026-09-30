-- AlterTable
ALTER TABLE "Devolucao" ADD COLUMN     "recebidaEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EnvioDevolucao" (
    "id" SERIAL NOT NULL,
    "devolucaoId" INTEGER NOT NULL,
    "provedor" TEXT NOT NULL DEFAULT 'MELHOR_ENVIO',
    "idExterno" TEXT,
    "servicoId" INTEGER NOT NULL,
    "transportadora" TEXT NOT NULL,
    "servico" TEXT NOT NULL,
    "custo" DECIMAL(10,2) NOT NULL,
    "compradaEm" TIMESTAMP(3),
    "geradaEm" TIMESTAMP(3),
    "codigoDevolucao" TEXT,
    "codigoRastreio" TEXT,
    "postadaEm" TIMESTAMP(3),
    "situacaoRastreio" TEXT,
    "rastreioAtualizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvioDevolucao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvioDevolucao_devolucaoId_key" ON "EnvioDevolucao"("devolucaoId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvioDevolucao_idExterno_key" ON "EnvioDevolucao"("idExterno");

-- AddForeignKey
ALTER TABLE "EnvioDevolucao" ADD CONSTRAINT "EnvioDevolucao_devolucaoId_fkey" FOREIGN KEY ("devolucaoId") REFERENCES "Devolucao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

