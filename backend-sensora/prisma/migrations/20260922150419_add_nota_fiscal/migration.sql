-- CreateEnum
CREATE TYPE "StatusFiscal" AS ENUM ('NAO_EMITIDA', 'PROCESSANDO', 'EMITIDA', 'REJEITADA', 'ERRO', 'CANCELADA');

-- CreateTable
CREATE TABLE "NotaFiscal" (
    "id" SERIAL NOT NULL,
    "pedidoId" INTEGER NOT NULL,
    "status" "StatusFiscal" NOT NULL DEFAULT 'NAO_EMITIDA',
    "numero" TEXT,
    "serie" TEXT,
    "chaveAcesso" TEXT,
    "protocolo" TEXT,
    "xmlUrl" TEXT,
    "pdfUrl" TEXT,
    "mensagemErro" TEXT,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "destinatarioNome" TEXT,
    "destinatarioDocumento" TEXT,
    "destinatarioEmail" TEXT,
    "enderecoCep" TEXT,
    "enderecoRua" TEXT,
    "enderecoNumero" TEXT,
    "enderecoComplemento" TEXT,
    "enderecoBairro" TEXT,
    "enderecoCidade" TEXT,
    "enderecoEstado" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "emitidoEm" TIMESTAMP(3),

    CONSTRAINT "NotaFiscal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscal_pedidoId_key" ON "NotaFiscal"("pedidoId");

-- AddForeignKey
ALTER TABLE "NotaFiscal" ADD CONSTRAINT "NotaFiscal_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
