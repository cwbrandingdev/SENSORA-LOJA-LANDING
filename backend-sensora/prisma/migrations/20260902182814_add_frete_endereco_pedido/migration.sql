-- AlterTable
ALTER TABLE "Pedido" ADD COLUMN     "enderecoBairro" TEXT,
ADD COLUMN     "enderecoCep" TEXT,
ADD COLUMN     "enderecoCidade" TEXT,
ADD COLUMN     "enderecoComplemento" TEXT,
ADD COLUMN     "enderecoEstado" TEXT,
ADD COLUMN     "enderecoNumero" TEXT,
ADD COLUMN     "enderecoRua" TEXT,
ADD COLUMN     "fretePrazoDias" INTEGER,
ADD COLUMN     "freteServico" TEXT,
ADD COLUMN     "freteServicoId" INTEGER,
ADD COLUMN     "freteTransportadora" TEXT,
ADD COLUMN     "freteValor" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "MelhorEnvioToken" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MelhorEnvioToken_pkey" PRIMARY KEY ("id")
);
