import { Module } from '@nestjs/common';
import { EnderecosModule } from '../enderecos/enderecos.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

// Fase B (Admin/Clientes reais) — EnderecosModule importado só para
// UsuariosService.buscarDetalheCliente reutilizar EnderecosService.
// findByUsuario() (nenhuma lógica de endereço duplicada). Sem risco de
// ciclo: EnderecosModule não importa UsuariosModule (nem nada que o
// importe) em nenhum ponto.
@Module({
  imports: [EnderecosModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
