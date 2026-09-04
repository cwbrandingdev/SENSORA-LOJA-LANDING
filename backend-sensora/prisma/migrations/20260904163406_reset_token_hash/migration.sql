-- Etapa 8.3 (achado HIGH da auditoria de segurança — resetToken em texto puro)
--
-- Substitui `resetToken` (armazenava o token de redefinição de senha em
-- texto puro) por `resetTokenHash` (hash SHA-256, mesmo mecanismo já usado
-- por emailVerificationHash/RefreshToken.tokenHash — ver AuthService.hashToken()).
--
-- Valores plaintext existentes NÃO podem ser convertidos em hash de forma
-- retroativa sem conhecer o token original enviado por e-mail -- por isso
-- são descartados aqui (DROP COLUMN), nunca "hasheados" como se fossem o
-- token real. Nenhum usuário/conta é afetado: quem tiver uma solicitação de
-- redefinição de senha pendente no momento desta migration simplesmente
-- precisa solicitar um novo link em /forgot-password — o fluxo continua
-- funcionando normalmente, só o token específico em voo se torna inválido
-- (o mesmo efeito de deixá-lo expirar naturalmente, só que imediato).
-- Nenhuma outra coluna/tabela é afetada.

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "resetTokenHash" TEXT;
ALTER TABLE "Usuario" DROP COLUMN "resetToken";

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_resetTokenHash_key" ON "Usuario"("resetTokenHash");
