import { forwardRef, Module } from '@nestjs/common';
import { PedidosModule } from '../pedidos/pedidos.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { ItensPedidoController } from './itens-pedido.controller';
import { ItensPedidoService } from './itens-pedido.service';

@Module({
  imports: [forwardRef(() => PedidosModule), ProdutosModule],
  controllers: [ItensPedidoController],
  providers: [ItensPedidoService],
  exports: [ItensPedidoService],
})
export class ItensPedidoModule {}
