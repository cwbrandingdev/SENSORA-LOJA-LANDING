import { forwardRef, Module } from '@nestjs/common';
import { AsaasModule } from '../asaas/asaas.module';
import { EnderecosModule } from '../enderecos/enderecos.module';
import { MailModule } from '../mail/mail.module';
import { ItensPedidoModule } from '../itens-pedido/itens-pedido.module';
import { MelhorEnvioModule } from '../melhor-envio/melhor-envio.module';
import { OcorrenciasModule } from '../ocorrencias/ocorrencias.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { PedidoEtiquetaController } from './pedido-etiqueta.controller';
import { PedidoEtiquetaService } from './pedido-etiqueta.service';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

@Module({
  // Etapa 5A (Cancelamento de Pedido) — PedidosService.cancelar() precisa de
  // ProdutosService.adicionarEstoque() para restaurar o estoque. Sem
  // forwardRef: ProdutosModule não depende de PedidosModule, então não há
  // ciclo (diferente de ItensPedidoModule, que já importa ProdutosModule do
  // mesmo jeito).
  // Etapa 5B.4 — PedidosService.solicitarReembolso() precisa de AsaasService
  // (resolverPaymentIdPorCheckout/consultarEstornos/estornarPagamento). Sem
  // forwardRef pelo mesmo motivo: AsaasModule não depende de PedidosModule.
  imports: [
    forwardRef(() => ItensPedidoModule),
    ProdutosModule,
    AsaasModule,
    EnderecosModule,
    OcorrenciasModule,
    MelhorEnvioModule,
    MailModule,
  ],
  controllers: [PedidosController, PedidoEtiquetaController],
  providers: [PedidosService, PedidoEtiquetaService],
  exports: [PedidosService],
})
export class PedidosModule {}
