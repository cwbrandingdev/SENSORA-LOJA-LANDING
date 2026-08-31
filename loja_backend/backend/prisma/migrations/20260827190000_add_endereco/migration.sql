-- CreateTable
CREATE TABLE "Endereco" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "rua" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "padrao" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Endereco_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Endereco" ADD CONSTRAINT "Endereco_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
