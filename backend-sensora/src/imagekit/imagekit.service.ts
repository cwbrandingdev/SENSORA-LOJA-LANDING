import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ImageKit from 'imagekit';
import { ImagekitAuthParams } from './entities/imagekit-auth.entity';

// Central de Integrações (Admin) — resultado de uma verificação real sob
// demanda (botão "Verificar agora"). Nunca lançado como exceção: o
// controller sempre devolve 200 com este shape, mesmo quando `operational`
// é false. `mensagem` é sempre texto genérico (nunca o corpo de erro do SDK
// ImageKit, que pode ecoar detalhes internos da conta).
export interface ImagekitVerificacaoOperacional {
  operational: boolean;
  mensagem?: string;
}

// IMAGEKIT_PUBLIC_KEY/IMAGEKIT_PRIVATE_KEY/IMAGEKIT_URL_ENDPOINT não estão no
// ConfigModule.validationSchema (app.module.ts) de propósito: são opcionais
// para o boot da aplicação (assim como as demais rotas continuam de pé sem
// elas configuradas) e só passam a ser exigidas quando alguém efetivamente
// chama GET /imagekit/auth — ver isConfigured()/gerarParametrosAutenticacao().
@Injectable()
export class ImagekitService {
  private readonly client: ImageKit | null;
  private readonly publicKey?: string;
  private readonly urlEndpoint?: string;

  constructor(private readonly configService: ConfigService) {
    const publicKey = this.configService.get<string>('IMAGEKIT_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('IMAGEKIT_PRIVATE_KEY');
    const urlEndpoint = this.configService.get<string>('IMAGEKIT_URL_ENDPOINT');

    if (publicKey && privateKey && urlEndpoint) {
      this.client = new ImageKit({ publicKey, privateKey, urlEndpoint });
      this.publicKey = publicKey;
      this.urlEndpoint = urlEndpoint;
    } else {
      this.client = null;
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  // `urlEndpoint` não é secreto — é literalmente a URL pública do CDN, já
  // usada para montar a URL de qualquer imagem de produto em páginas
  // públicas da loja. Seguro de expor na tela de status, ao contrário de
  // `publicKey`/`privateKey`.
  get urlEndpointConfigurado(): string | undefined {
    return this.urlEndpoint;
  }

  // Central de Integrações (Admin) — verificação real sob demanda (botão
  // "Verificar agora"), nunca automática. `listFiles({ limit: 1 })` é a
  // leitura mais barata do SDK oficial (GET /v1/files): confirma que
  // IMAGEKIT_PRIVATE_KEY realmente autentica contra a API, sem fazer
  // upload nem alterar nada. Nunca lança: qualquer falha vira
  // `{ operational: false, mensagem }` com texto genérico — o erro do SDK
  // nunca é repassado ao chamador.
  async verificarOperacional(): Promise<ImagekitVerificacaoOperacional> {
    if (!this.client) {
      return {
        operational: false,
        mensagem: 'ImageKit não está configurado neste ambiente.',
      };
    }

    try {
      await this.client.listFiles({ limit: 1 });
      return { operational: true };
    } catch {
      return {
        operational: false,
        mensagem: 'Não foi possível verificar a integração com o ImageKit.',
      };
    }
  }

  // Gera token/expire/signature sob demanda a cada chamada (nunca persiste
  // nada em banco) usando o SDK oficial — a privateKey nunca sai deste
  // método: getAuthenticationParameters() só a usa internamente para
  // calcular o HMAC da signature.
  gerarParametrosAutenticacao(): ImagekitAuthParams {
    if (!this.client || !this.publicKey || !this.urlEndpoint) {
      // Etapa 10 / Task 6 (achado H10): mensagem genérica — a versão
      // anterior citava os nomes exatos das variáveis de ambiente
      // ausentes na resposta ao cliente, informação interna que não deve
      // sair da aplicação (mesmo que só STAFF autenticado veja essa rota).
      throw new InternalServerErrorException(
        'ImageKit não está configurado neste ambiente.',
      );
    }

    const { token, expire, signature } =
      this.client.getAuthenticationParameters();

    return {
      token,
      expire,
      signature,
      publicKey: this.publicKey,
      urlEndpoint: this.urlEndpoint,
    };
  }
}
