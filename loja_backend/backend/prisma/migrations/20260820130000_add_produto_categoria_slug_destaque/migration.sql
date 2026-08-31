-- 1) Add new columns as nullable first, so existing rows are never rejected.
ALTER TABLE "Produto" ADD COLUMN "slug" TEXT;
ALTER TABLE "Produto" ADD COLUMN "destaque" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Categoria" ADD COLUMN "slug" TEXT;

-- 2) Backfill slug for existing rows from "nome": lowercase, strip accents,
--    replace anything that isn't a-z0-9 with "-", trim stray hyphens.
--    If two rows normalize to the same base slug, only the first (lowest id)
--    keeps the clean slug; the rest get "-{id}" appended to stay unique.
WITH base AS (
  SELECT
    id,
    trim(both '-' from regexp_replace(
      translate(
        lower(nome),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+', '-', 'g'
    )) AS base_slug
  FROM "Produto"
),
ranked AS (
  SELECT id, base_slug, ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY id) AS rn
  FROM base
)
UPDATE "Produto" p
SET "slug" = CASE WHEN r.rn = 1 THEN r.base_slug ELSE r.base_slug || '-' || r.id END
FROM ranked r
WHERE p.id = r.id;

WITH base AS (
  SELECT
    id,
    trim(both '-' from regexp_replace(
      translate(
        lower(nome),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+', '-', 'g'
    )) AS base_slug
  FROM "Categoria"
),
ranked AS (
  SELECT id, base_slug, ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY id) AS rn
  FROM base
)
UPDATE "Categoria" c
SET "slug" = CASE WHEN r.rn = 1 THEN r.base_slug ELSE r.base_slug || '-' || r.id END
FROM ranked r
WHERE c.id = r.id;

-- 3) Only now that every existing row has a slug, enforce NOT NULL + UNIQUE.
ALTER TABLE "Produto" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Produto_slug_key" ON "Produto"("slug");

ALTER TABLE "Categoria" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Categoria_slug_key" ON "Categoria"("slug");
