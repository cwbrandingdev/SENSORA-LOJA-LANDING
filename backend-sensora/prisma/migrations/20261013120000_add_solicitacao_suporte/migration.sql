-- CreateEnum
CREATE TYPE "StatusSolicitacaoSuporte" AS ENUM ('ABERTA', 'EM_ATENDIMENTO', 'RESOLVIDA');

-- CreateTable
CREATE TABLE "SolicitacaoSuporte" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "mensagem" TEXT NOT NULL,
    "status" "StatusSolicitacaoSuporte" NOT NULL DEFAULT 'ABERTA',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolicitacaoSuporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitacaoSuporte_usuarioId_idx" ON "SolicitacaoSuporte"("usuarioId");

-- CreateIndex
CREATE INDEX "SolicitacaoSuporte_status_criadaEm_idx" ON "SolicitacaoSuporte"("status", "criadaEm" DESC);

-- CreateIndex
CREATE INDEX "SolicitacaoSuporte_criadaEm_idx" ON "SolicitacaoSuporte"("criadaEm" DESC);

-- AddForeignKey
ALTER TABLE "SolicitacaoSuporte" ADD CONSTRAINT "SolicitacaoSuporte_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
