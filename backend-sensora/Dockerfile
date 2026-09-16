# Sensora — backend NestJS 11 + Prisma 7 (deploy no Fly.io).
#
# O Prisma Client é gerado por `prisma generate` (hook "postinstall" do
# package.json) para `generated/prisma` — pasta fora de node_modules (ver
# `output` em prisma/schema.prisma) e importada por
# src/prisma/prisma.service.ts. Como a PrismaService usa o driver adapter
# `@prisma/adapter-pg` (Pool do `pg`) em vez do engine nativo do Prisma, o
# client gerado é só TypeScript/JS puro — não há binário de engine para
# baixar/copiar em runtime.
#
# `prisma generate` não precisa de conexão real com o banco (só lê o
# schema), então o build funciona sem DATABASE_URL — DATABASE_URL e os
# demais secrets são sempre injetados em runtime pelo ambiente do Fly
# (`fly secrets`), nunca gravados aqui.
#
# fly.toml define `[deploy] release_command = 'npx prisma migrate deploy'`,
# executado a partir desta MESMA imagem final (runner). Por isso o runner
# não pode se limitar ao runtime da aplicação: `migrate deploy` precisa (1)
# de `prisma/schema.prisma` + `prisma/migrations/` (não só o Prisma Client
# já gerado) e (2) do próprio pacote `prisma` (CLI, devDependency) e da sua
# dependência `dotenv` (exigida por `prisma.config.js`). Como isso não pode
# vir de `package.json` (permanece devDependency), o node_modules instalado
# no builder é copiado inteiro para o runner — sem `npm prune --omit=dev` —
# para garantir a CLI disponível sem precisar baixar nada via `npx` em
# release-time.
#
# Estágio único "builder" + estágio final "runner": o builder instala TODAS
# as dependências (dev incluídas — exigidas por `nest build` e por `prisma
# migrate deploy` em release_command) e compila. O runner final copia
# node_modules completo, o Prisma Client gerado, `prisma/` (schema +
# migrations), `prisma.config.js` e `dist/`, sem toolchain de build (gcc/
# python só existem no builder).

FROM node:24-alpine AS builder
WORKDIR /app

# python3/make/g++ — só neste estágio, para compilar módulos nativos
# (bcrypt) via node-gyp quando não há binário pré-compilado para musl/
# alpine. Nunca chegam à imagem final.
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.js ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.js ./prisma.config.js
COPY package.json ./

EXPOSE 3000

CMD ["node", "dist/src/main"]
