import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EnderecosModule } from '../enderecos/enderecos.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

// Fase B (Admin/Clientes reais) — EnderecosModule importado só para
// UsuariosService.buscarDetalheCliente reutilizar EnderecosService.
// findByUsuario() (nenhuma lógica de endereço duplicada). Sem risco de
// ciclo: EnderecosModule não importa UsuariosModule (nem nada que o
// importe) em nenhum ponto.
// AuthModule (forwardRef): PUT /usuarios/me usa AuthService.atualizarMeusDados
// para confirmar um e-mail trocado — AuthModule, por sua vez, já importa
// este módulo (UsuariosService), daí a referência circular declarada.
@Module({
  imports: [EnderecosModule, forwardRef(() => AuthModule)],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}
