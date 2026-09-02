import { Module } from '@nestjs/common';
import { AsaasModule } from '../asaas/asaas.module';
import { AuthModule } from '../auth/auth.module';
import { EnderecosModule } from '../enderecos/enderecos.module';
import { MelhorEnvioModule } from '../melhor-envio/melhor-envio.module';
import { ProdutosModule } from '../produtos/produtos.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  // Etapa 6.4 (Confirmação de e-mail) — UsuariosModule importado diretamente
  // (não basta importar AuthModule: ele não reexporta UsuariosService) para
  // CheckoutService poder checar emailVerificado antes de criar a sessão.
  // Etapa 6.5 (Frete) — MelhorEnvioModule, mesmo raciocínio de isolamento
  // de AsaasModule: CheckoutService só conhece MelhorEnvioService.cotar,
  // nunca monta a chamada HTTP para o Melhor Envio diretamente.
  imports: [
    ProdutosModule,
    AuthModule,
    EnderecosModule,
    AsaasModule,
    UsuariosModule,
    MelhorEnvioModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
