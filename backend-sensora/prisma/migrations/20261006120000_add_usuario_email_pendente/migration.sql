-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "emailPendente" TEXT,
ADD COLUMN     "emailPendenteExpiraEm" TIMESTAMP(3),
ADD COLUMN     "emailPendenteTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_emailPendenteTokenHash_key" ON "Usuario"("emailPendenteTokenHash");

