import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsuariosService } from '../../usuarios/usuarios.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UsuarioAutenticado } from '../interfaces/usuario-autenticado.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usuariosService: UsuariosService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? '',
    });
  }

  // Etapa 10 / Task 3 (achado A1): o token só prova que foi assinado pelo
  // backend em algum momento no passado — não que a conta ainda existe ou
  // segue ativa agora. Por isso toda requisição autenticada busca o usuário
  // no banco aqui, em vez de confiar direto no payload (que pode estar
  // desatualizado até a expiração do token).
  async validate(payload: JwtPayload): Promise<UsuarioAutenticado> {
    const usuario = await this.usuariosService.buscarAtivoPorId(payload.sub);

    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Sessão inválida ou usuário desativado.');
    }

    return {
      id: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
    };
  }
}
