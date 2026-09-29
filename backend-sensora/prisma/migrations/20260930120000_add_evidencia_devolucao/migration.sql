-- CreateTable
CREATE TABLE "EvidenciaDevolucao" (
    "id" SERIAL NOT NULL,
    "devolucaoId" INTEGER NOT NULL,
    "fileId" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenciaDevolucao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EvidenciaDevolucao_devolucaoId_idx" ON "EvidenciaDevolucao"("devolucaoId");

-- AddForeignKey
ALTER TABLE "EvidenciaDevolucao" ADD CONSTRAINT "EvidenciaDevolucao_devolucaoId_fkey" FOREIGN KEY ("devolucaoId") REFERENCES "Devolucao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
