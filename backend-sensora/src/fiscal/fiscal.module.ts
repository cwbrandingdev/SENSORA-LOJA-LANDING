import { Module } from '@nestjs/common';
import { FiscalService } from './fiscal.service';

// Infraestrutura Fiscal (preparação arquitetural) — deliberadamente sem
// nenhuma dependência de AsaasModule/MelhorEnvioModule/CheckoutModule:
// FiscalService só conhece PrismaService (global, via PrismaModule) e a
// abstração FiscalProvider (ver providers/fiscal-provider.interface.ts),
// nunca as classes concretas dos outros gateways — mesmo isolamento que já
// existe entre AsaasService e MelhorEnvioService hoje. Nenhum provider é
// registrado sob o token FISCAL_PROVIDER nesta etapa (nenhum provedor
// fiscal foi escolhido) — FiscalService trata isso como "não configurado"
// via @Optional() em seu construtor.
//
// Não importado por CheckoutModule/PedidosModule nesta etapa: nenhum fluxo
// de pagamento ou pedido chama FiscalService ainda (ver ponto 9 da tarefa).
// Registrado em AppModule só para existir como módulo funcional do app
// (instanciável, testável), pronto para uma etapa futura decidir quem
// passa a importá-lo.
@Module({
  providers: [FiscalService],
  exports: [FiscalService],
})
export class FiscalModule {}
