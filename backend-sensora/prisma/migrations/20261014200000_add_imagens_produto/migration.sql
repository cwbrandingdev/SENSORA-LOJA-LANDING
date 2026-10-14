-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "imagens" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Produtos já cadastrados: a galeria começa com a capa que já existe.
UPDATE "Produto" SET "imagens" = ARRAY["imagemUrl"] WHERE "imagemUrl" IS NOT NULL;
