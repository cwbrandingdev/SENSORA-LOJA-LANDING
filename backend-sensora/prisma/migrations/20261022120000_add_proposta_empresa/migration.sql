-- CreateEnum
CREATE TYPE "StatusPropostaEmpresa" AS ENUM ('NOVA', 'EM_CONTATO', 'ENCERRADA');

-- CreateTable
CREATE TABLE "PropostaEmpresa" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "empresa" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "objetivo" TEXT NOT NULL,
    "quantidade" TEXT NOT NULL,
    "mensagem" TEXT,
    "status" "StatusPropostaEmpresa" NOT NULL DEFAULT 'NOVA',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropostaEmpresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropostaEmpresa_criadaEm_idx" ON "PropostaEmpresa"("criadaEm" DESC);
