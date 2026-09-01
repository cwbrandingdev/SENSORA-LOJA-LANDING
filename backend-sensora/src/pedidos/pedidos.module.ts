import { forwardRef, Module } from '@nestjs/common';
import { ItensPedidoModule } from '../itens-pedido/itens-pedido.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

@Module({
  // Etapa 5A (Cancelamento de Pedido) — PedidosService.cancelar() precisa de
  // ProdutosService.adicionarEstoque() para restaurar o estoque. Sem
  // forwardRef: ProdutosModule não depende de PedidosModule, então não há
  // ciclo (diferente de ItensPedidoModule, que já importa ProdutosModule do
  // mesmo jeito).
  imports: [forwardRef(() => ItensPedidoModule), ProdutosModule],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
