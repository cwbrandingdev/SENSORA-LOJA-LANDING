import { Module } from '@nestjs/common';
import { AsaasModule } from '../asaas/asaas.module';
import { AuthModule } from '../auth/auth.module';
import { EnderecosModule } from '../enderecos/enderecos.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [ProdutosModule, AuthModule, EnderecosModule, AsaasModule],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
