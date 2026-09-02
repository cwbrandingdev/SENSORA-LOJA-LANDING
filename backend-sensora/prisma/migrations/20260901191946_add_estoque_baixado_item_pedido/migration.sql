-- AlterTable
ALTER TABLE "ItemPedido" ADD COLUMN     "estoqueBaixado" BOOLEAN;

-- Etapa 5A.2 (achado da auditoria 5A.1) — backfill conservador dos
-- registros históricos, feito só com o que o código GARANTE (não com
-- suposição):
--
-- 1) Pedido PAGO -> estoqueBaixado = true para TODOS os seus itens, sem
--    exceção. Garantido por CheckoutService.confirmarPagamento: qualquer
--    pedido que chegou a PAGO teve removerEstoque() chamado para cada um
--    de seus itens, incondicionalmente, seja qual for a origem do pedido.
UPDATE "ItemPedido" ip
SET "estoqueBaixado" = true
FROM "Pedido" p
WHERE p.id = ip."pedidoId" AND p.status = 'PAGO';

-- 2) Pedido NÃO PAGO (PENDENTE/CANCELADO) mas com asaasCheckoutId OU
--    stripeSessionId preenchido -> estoqueBaixado = false. Garantido:
--    SÓ o fluxo de checkout (criarSessaoAsaas/criarSessaoStripe) preenche
--    esses campos, e CheckoutService.createSession nunca decrementa
--    estoque na criação (só confirmarPagamento decrementa, tratado no
--    passo 1 acima). Sinal positivo confiável (presença = certeza).
UPDATE "ItemPedido" ip
SET "estoqueBaixado" = false
FROM "Pedido" p
WHERE p.id = ip."pedidoId"
  AND p.status <> 'PAGO'
  AND (p."asaasCheckoutId" IS NOT NULL OR p."stripeSessionId" IS NOT NULL);

-- 3) Todo o restante (PENDENTE/CANCELADO SEM asaasCheckoutId/stripeSessionId)
--    permanece NULL (indeterminado) — de propósito, sem UPDATE aqui.
--    Achado da auditoria 5A.1: a ausência desses campos NÃO é prova de
--    origem administrativa (um pedido de checkout que falhou entre criar
--    o Pedido e vincular o asaasCheckoutId/stripeSessionId fica idêntico,
--    nesse sinal, a um pedido administrativo real) — não é seguro assumir
--    nenhum dos dois lados. PedidosService.cancelar() bloqueia com erro
--    controlado ao encontrar um item nesse estado, em vez de arriscar
--    restaurar (ou deixar de restaurar) estoque incorretamente.
