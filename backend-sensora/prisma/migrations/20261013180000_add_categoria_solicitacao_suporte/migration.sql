-- CreateEnum
CREATE TYPE "CategoriaSuporte" AS ENUM ('PRODUTO', 'PEDIDO_ENTREGA', 'TROCA_DEVOLUCAO', 'PAGAMENTO', 'CONTA', 'OUTRO');

-- AlterTable
ALTER TABLE "SolicitacaoSuporte" ADD COLUMN     "categoria" "CategoriaSuporte" NOT NULL DEFAULT 'OUTRO';
