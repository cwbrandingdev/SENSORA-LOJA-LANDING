import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ONLY_ROLES, STAFF_ROLES } from '../common/constants/roles.constants';
import { RolesGuard } from '../common/guards/roles.guard';
import { ImagekitAuthParams } from './entities/imagekit-auth.entity';
import { ImagekitService } from './imagekit.service';

// Etapa 7: a checagem manual de perfil que existia aqui foi substituída pelo
// RolesGuard reutilizável (mesmo mecanismo agora usado em /produtos,
// /categorias, /clientes, /pedidos, /itens-pedido). Liberado para
// ADMIN + VENDEDOR — sem isso, VENDEDOR não conseguiria subir imagem ao
// gerenciar produtos.
@Controller('imagekit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...STAFF_ROLES)
export class ImagekitController {
  constructor(private readonly imagekitService: ImagekitService) {}

  @Get('auth')
  auth(): ImagekitAuthParams {
    return this.imagekitService.gerarParametrosAutenticacao();
  }

  // Central de Integrações (Admin) — thin wrapper sobre
  // ImagekitService.isConfigured() (já existente), nunca expõe
  // IMAGEKIT_PRIVATE_KEY. @Roles aqui (nível de método) sobrescreve o
  // STAFF_ROLES da classe só para esta rota — RolesGuard usa
  // getAllAndOverride, então @Get('auth') acima continua ADMIN+VENDEDOR
  // (upload de produto intocado); só /imagekit/status vira ADMIN-only,
  // igual à página /admin/integracoes.
  @Get('status')
  @Roles(...ADMIN_ONLY_ROLES)
  status(): { configured: boolean } {
    return { configured: this.imagekitService.isConfigured() };
  }
}
