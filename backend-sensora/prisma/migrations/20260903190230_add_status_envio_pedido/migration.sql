-- CreateEnum
CREATE TYPE "StatusEnvio" AS ENUM ('NAO_ENVIADO', 'ENVIADO');

-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "enviadoEm" TIMESTAMP(3),
ADD COLUMN     "statusEnvio" "StatusEnvio" NOT NULL DEFAULT 'NAO_ENVIADO';
