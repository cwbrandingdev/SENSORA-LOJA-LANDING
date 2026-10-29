import { Module } from '@nestjs/common';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { CuponsController } from './cupons.controller';
import { CuponsPublicoController } from './cupons-publico.controller';
import { CuponsSimularController } from './cupons-simular.controller';
import { CuponsService } from './cupons.service';

@Module({
  imports: [UsuariosModule],
  controllers: [
    CuponsController,
    CuponsSimularController,
    CuponsPublicoController,
  ],
  providers: [CuponsService],
  exports: [CuponsService],
})
export class CuponsModule {}
