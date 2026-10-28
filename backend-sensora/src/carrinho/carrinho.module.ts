import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { CarrinhoController } from './carrinho.controller';
import { CarrinhoService } from './carrinho.service';

@Module({
  imports: [MailModule],
  controllers: [CarrinhoController],
  providers: [CarrinhoService],
  exports: [CarrinhoService],
})
export class CarrinhoModule {}
