-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "emailVerificado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailVerificadoEm" TIMESTAMP(3),
ADD COLUMN     "emailVerificationExpiry" TIMESTAMP(3),
ADD COLUMN     "emailVerificationHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_emailVerificationHash_key" ON "Usuario"("emailVerificationHash");

