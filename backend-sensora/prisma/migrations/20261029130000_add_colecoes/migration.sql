-- CreateTable
CREATE TABLE "Colecao" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descricao" TEXT,
    "imagemUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Colecao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ColecaoToProduto" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ColecaoToProduto_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Colecao_slug_key" ON "Colecao"("slug");

-- CreateIndex
CREATE INDEX "_ColecaoToProduto_B_index" ON "_ColecaoToProduto"("B");

-- AddForeignKey
ALTER TABLE "_ColecaoToProduto" ADD CONSTRAINT "_ColecaoToProduto_A_fkey" FOREIGN KEY ("A") REFERENCES "Colecao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ColecaoToProduto" ADD CONSTRAINT "_ColecaoToProduto_B_fkey" FOREIGN KEY ("B") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

