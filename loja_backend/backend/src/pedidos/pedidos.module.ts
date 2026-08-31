import { forwardRef, Module } from '@nestjs/common';
import { ItensPedidoModule } from '../itens-pedido/itens-pedido.module';
import { PedidosController } from './pedidos.controller';
import { PedidosService } from './pedidos.service';

@Module({
  imports: [forwardRef(() => ItensPedidoModule)],
  controllers: [PedidosController],
  providers: [PedidosService],
  exports: [PedidosService],
})
export class PedidosModule {}
