-- CreateEnum
CREATE TYPE "TipoAlertaAdmin" AS ENUM (
  'ESTOQUE_BAIXO',
  'REEMBOLSO_SOLICITADO',
  'PEDIDO_AGUARDANDO_ENVIO',
  'MELHOR_ENVIO_DESCONECTADO',
  'DEVOLUCAO_SOLICITADA',
  'PEDIDO_NOVO',
  'SUPORTE_ABERTO',
  'AVALIACAO_PENDENTE'
);

-- CreateTable
CREATE TABLE "EstadoAlertaAdmin" (
  "usuarioId" INTEGER NOT NULL,
  "tipo" "TipoAlertaAdmin" NOT NULL,
  "excluidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EstadoAlertaAdmin_pkey" PRIMARY KEY ("usuarioId", "tipo")
);

-- AddForeignKey
ALTER TABLE "EstadoAlertaAdmin"
ADD CONSTRAINT "EstadoAlertaAdmin_usuarioId_fkey"
FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
