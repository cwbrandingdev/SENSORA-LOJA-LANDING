import {
  BadGatewayException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MelhorEnvioTokenCryptoService } from './melhor-envio-token-crypto.service';

export interface MelhorEnvioPacote {
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
  pesoGramas: number;
}

export interface MelhorEnvioCotacaoInput {
  cepDestino: string;
  pacote: MelhorEnvioPacote;
  valorDeclarado: number;
}

export interface MelhorEnvioOpcao {
  id: number;
  transportadora: string;
  servico: string;
  preco: number;
  prazoDias: number;
}

// Etapa 6.5 (Frete) — mesmo raciocínio de classes de erro dedicadas já usado
// em AsaasService: o chamador (CheckoutService) precisa distinguir "Melhor
// Envio recusou/está fora do ar" (retry manual faz sentido) de "a loja ainda
// nem conectou a conta" (erro de configuração, não do cliente).
export class MelhorEnvioErroHttpError extends BadGatewayException {}
export class MelhorEnvioIndisponivelError extends BadGatewayException {}
export class MelhorEnvioNaoConectadoError extends InternalServerErrorException {}

// Contrato explícito consumido pelo frontend (ver lib/errors.ts,
// CODIGOS_ERRO_SEGUROS) — identifica, na resposta HTTP, mensagens de erro
// que já são seguras e foram produzidas deliberadamente por este serviço
// para o fluxo de cotação de frete (nunca stack trace/SQL/segredo). Só
// `cotar()` (abaixo, via `comCodigoDeFrete`) anexa este código — os mesmos
// erros lançados pelo fluxo de OAuth (trocarCodigoPorToken/conectar) nunca
// o recebem, preservando o comportamento atual desse fluxo. Mantenha o
// valor sincronizado com a constante equivalente em
// frontend-sensora/lib/errors.ts caso precise alterá-lo.
export const CODIGO_ERRO_FRETE_MELHOR_ENVIO = 'FRETE_MELHOR_ENVIO_INDISPONIVEL';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// Renova um pouco antes da expiração real — evita usar um access_token que
// expira no meio de uma requisição em voo.
const MARGEM_EXPIRACAO_MS = 60_000;

// Cliente HTTP fino para a API do Melhor Envio (sem SDK oficial em Node —
// fetch nativo, mesmo padrão do AsaasService), cobrindo OAuth2 (Parte 2 da
// etapa) e cotação de frete (Parte 3). Isolado de propósito: nenhuma outra
// classe do projeto monta uma URL/chama fetch contra o Melhor Envio —
// CheckoutService só conhece os métodos públicos daqui.
@Injectable()
export class MelhorEnvioService {
  private readonly logger = new Logger(MelhorEnvioService.name);
  private readonly baseUrl: string;
  private readonly ambiente: 'sandbox' | 'production';
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly redirectUri?: string;
  private readonly scope: string;
  private readonly userAgent?: string;
  private readonly cepOrigem?: string;
  private readonly pacotePadrao: MelhorEnvioPacote;

  // Estado do fluxo "authorize" (Parte 2) — só precisa sobreviver entre a
  // chamada que gera a URL de autorização (disparada manualmente por um
  // ADMIN) e o callback que o Melhor Envio chama alguns segundos/minutos
  // depois. Guardado em memória, não no banco: é só proteção CSRF do fluxo
  // de conexão (não é dado de negócio), e um restart do backend nesse
  // intervalo raríssimo só obriga o admin a clicar em "Conectar" de novo.
  private state?: { valor: string; expiraEm: number };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: MelhorEnvioTokenCryptoService,
  ) {
    // Central de Integrações (Admin) — guardado como campo (antes só uma
    // variável local do construtor) para ser exposto por `ambiente`
    // abaixo, sem duplicar a leitura de MELHOR_ENVIO_ENV. Nunca hardcoded
    // fora deste ponto único — todo o resto do serviço só usa
    // `this.baseUrl`.
    this.ambiente =
      this.configService.get<string>('MELHOR_ENVIO_ENV') === 'production'
        ? 'production'
        : 'sandbox';
    this.baseUrl =
      this.ambiente === 'production'
        ? 'https://melhorenvio.com.br'
        : 'https://sandbox.melhorenvio.com.br';
    this.clientId = this.configService.get<string>('MELHOR_ENVIO_CLIENT_ID');
    this.clientSecret = this.configService.get<string>(
      'MELHOR_ENVIO_CLIENT_SECRET',
    );
    this.redirectUri = this.configService.get<string>(
      'MELHOR_ENVIO_REDIRECT_URI',
    );
    this.scope =
      this.configService.get<string>('MELHOR_ENVIO_SCOPE') ??
      'shipping-calculate';
    this.userAgent = this.configService.get<string>('MELHOR_ENVIO_USER_AGENT');
    this.cepOrigem = this.configService.get<string>('MELHOR_ENVIO_CEP_ORIGEM');
    // Etapa 6.5 (achado da auditoria 6.5): Produto não tem peso/dimensões
    // modelados (fora do escopo desta etapa alterar o cadastro de produto/
    // admin). Fallback único e configurável para todo o carrinho — nunca
    // por produto real ainda — documentado como limitação conhecida no
    // relatório final.
    this.pacotePadrao = {
      alturaCm: Number(
        this.configService.get<string>('MELHOR_ENVIO_PACOTE_ALTURA_CM') ?? 10,
      ),
      larguraCm: Number(
        this.configService.get<string>('MELHOR_ENVIO_PACOTE_LARGURA_CM') ??
          15,
      ),
      comprimentoCm: Number(
        this.configService.get<string>(
          'MELHOR_ENVIO_PACOTE_COMPRIMENTO_CM',
        ) ?? 20,
      ),
      pesoGramas: Number(
        this.configService.get<string>('MELHOR_ENVIO_PACOTE_PESO_GRAMAS') ??
          300,
      ),
    };
  }

  get pacotePadraoConfigurado(): MelhorEnvioPacote {
    return this.pacotePadrao;
  }

  // Central de Integrações (Admin) — credenciais OAuth2 presentes neste
  // ambiente. Distinto de `estaConectado()`: aqui só confirma que
  // CLIENT_ID/CLIENT_SECRET/REDIRECT_URI existem (o mesmo que
  // `garantirCredenciaisConfiguradas()` valida antes de iniciar o fluxo),
  // nunca se a loja já concluiu a autorização de verdade.
  get configured(): boolean {
    return Boolean(this.clientId && this.clientSecret && this.redirectUri);
  }

  // `ambiente` não é secreto (só diz sandbox vs. produção, mesmo raciocínio
  // de AsaasService.gatewayAtivo) — seguro de expor na tela de status.
  get ambienteConfigurado(): 'sandbox' | 'production' {
    return this.ambiente;
  }

  // Central de Integrações (Admin) — status completo para a tela de
  // Integrações: `configured` (credenciais presentes) e `conectado` (token
  // salvo — mesma condição de estaConectado(), mas resolvida numa única
  // query aqui para também devolver `expiresAt` sem uma segunda ida ao
  // banco) são conceitos DIFERENTES — configurado sem nunca ter conectado é
  // um estado real e comum (credenciais cadastradas, ADMIN ainda não clicou
  // em "Conectar"). `expiresAt` é a validade do access token atual, nunca o
  // token em si — `null` quando não conectado.
  async obterStatusConexao(): Promise<{
    configured: boolean;
    conectado: boolean;
    ambiente: 'sandbox' | 'production';
    expiresAt: string | null;
  }> {
    const token = await this.prisma.melhorEnvioToken.findUnique({
      where: { id: 1 },
    });
    return {
      configured: this.configured,
      conectado: token !== null,
      ambiente: this.ambiente,
      expiresAt: token ? token.expiresAt.toISOString() : null,
    };
  }

  // Central de Integrações (Admin) — verificação real sob demanda (botão
  // "Verificar agora"), nunca automática. GET /api/v2/me é a leitura
  // autenticada mais barata da API do Melhor Envio (confirma que o access
  // token armazenado ainda autentica de verdade, distinto de `conectado`
  // acima, que só prova que existe uma linha salva no banco) — nunca cota
  // frete nem gera nenhum efeito colateral. Reaproveita
  // garantirAccessToken() (mesma renovação automática já usada por
  // cotar()), nenhuma lógica de token duplicada. Nunca lança: qualquer
  // falha (não conectado, rede, recusa do Melhor Envio) vira
  // `{ operational: false, mensagem }` com a mesma mensagem segura já usada
  // pelas exceções deste serviço — nunca client_secret/token/corpo cru da
  // resposta do Melhor Envio.
  async verificarOperacional(): Promise<{
    operational: boolean;
    mensagem?: string;
  }> {
    try {
      const accessToken = await this.garantirAccessToken();

      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}/api/v2/me`, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${accessToken}`,
            ...(this.userAgent ? { 'User-Agent': this.userAgent } : {}),
          },
        });
      } catch {
        return {
          operational: false,
          mensagem: 'Não foi possível se comunicar com o Melhor Envio.',
        };
      }

      if (!response.ok) {
        // Mesmo padrão de log de executarCotacao: status/statusText no log
        // do servidor, nunca no que volta para o chamador.
        this.logger.error(
          `Melhor Envio recusou GET /api/v2/me -> ${response.status} ${response.statusText}`,
        );
        return {
          operational: false,
          mensagem: 'O Melhor Envio recusou a verificação da conexão.',
        };
      }

      return { operational: true };
    } catch (erro) {
      const mensagem =
        erro instanceof HttpException
          ? this.extrairMensagem(erro)
          : 'Não foi possível verificar a integração com o Melhor Envio.';
      return { operational: false, mensagem };
    }
  }

  // ---- OAuth2 (Parte 2) ---------------------------------------------------

  gerarUrlAutorizacao(): string {
    this.garantirCredenciaisConfiguradas();
    const valor = randomBytes(24).toString('hex');
    this.state = { valor, expiraEm: Date.now() + 10 * 60_000 };

    const params = new URLSearchParams({
      client_id: this.clientId!,
      redirect_uri: this.redirectUri!,
      response_type: 'code',
      scope: this.scope,
      state: valor,
    });
    return `${this.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  async trocarCodigoPorToken(code: string, state: string): Promise<void> {
    this.garantirCredenciaisConfiguradas();

    if (
      !this.state ||
      this.state.valor !== state ||
      this.state.expiraEm < Date.now()
    ) {
      throw new MelhorEnvioErroHttpError(
        'state inválido ou expirado — reinicie a conexão com o Melhor Envio',
      );
    }
    this.state = undefined; // uso único — nunca aceita o mesmo state duas vezes

    const resposta = await this.requestToken({
      grant_type: 'authorization_code',
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      redirect_uri: this.redirectUri!,
      code,
    });

    await this.persistirToken(resposta);
  }

  async estaConectado(): Promise<boolean> {
    const token = await this.prisma.melhorEnvioToken.findUnique({
      where: { id: 1 },
    });
    return token !== null;
  }

  // Etapa 8.4 (achado HIGH da auditoria — tokens em texto puro) — único
  // ponto de escrita de MelhorEnvioToken (chamado tanto pela troca inicial
  // de code->token em trocarCodigoPorToken quanto pela renovação via
  // refresh_token em garantirAccessToken abaixo), então criptografar aqui
  // cobre os dois caminhos de uma vez — nenhum caminho secundário grava
  // token sem passar por encrypt().
  private async persistirToken(resposta: TokenResponse): Promise<void> {
    const expiresAt = new Date(Date.now() + resposta.expires_in * 1000);
    const accessTokenCriptografado = this.tokenCrypto.encrypt(
      resposta.access_token,
    );
    const refreshTokenCriptografado = this.tokenCrypto.encrypt(
      resposta.refresh_token,
    );
    await this.prisma.melhorEnvioToken.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        accessToken: accessTokenCriptografado,
        refreshToken: refreshTokenCriptografado,
        expiresAt,
      },
      update: {
        accessToken: accessTokenCriptografado,
        refreshToken: refreshTokenCriptografado,
        expiresAt,
      },
    });
  }

  private async garantirAccessToken(): Promise<string> {
    this.garantirCredenciaisConfiguradas();
    const token = await this.prisma.melhorEnvioToken.findUnique({
      where: { id: 1 },
    });
    if (!token) {
      throw new MelhorEnvioNaoConectadoError(
        'A loja ainda não está conectada ao Melhor Envio.',
      );
    }

    if (token.expiresAt.getTime() - MARGEM_EXPIRACAO_MS > Date.now()) {
      return this.tokenCrypto.decrypt(token.accessToken);
    }

    // Renova ANTES de qualquer chamada de cotação, nunca reativamente após
    // um 401 — evita depender de retry específico de status na chamada de
    // cotação em si.
    const resposta = await this.requestToken({
      grant_type: 'refresh_token',
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      refresh_token: this.tokenCrypto.decrypt(token.refreshToken),
    });
    await this.persistirToken(resposta);
    return resposta.access_token;
  }

  private async requestToken(
    body: Record<string, string>,
  ): Promise<TokenResponse> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new MelhorEnvioIndisponivelError(
        'Não foi possível se comunicar com o Melhor Envio',
      );
    }

    if (!response.ok) {
      // Nunca loga `body` (carrega client_secret/refresh_token) nem o corpo
      // da resposta de erro — só status/statusText, mesmo padrão de nunca
      // logar segredo do AsaasService.
      this.logger.error(
        `Melhor Envio recusou POST /oauth/token -> ${response.status} ${response.statusText}`,
      );
      throw new MelhorEnvioErroHttpError(
        'O Melhor Envio recusou a autenticação',
      );
    }

    try {
      return (await response.json()) as TokenResponse;
    } catch {
      throw new MelhorEnvioErroHttpError('Resposta inválida do Melhor Envio');
    }
  }

  private garantirCredenciaisConfiguradas(): void {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new InternalServerErrorException(
        'MELHOR_ENVIO_CLIENT_ID/CLIENT_SECRET/REDIRECT_URI não configuradas',
      );
    }
  }

  // ---- Cotação (Parte 3) --------------------------------------------------

  // Ponto único chamado pelo CheckoutController/CheckoutService — nunca lança
  // a exceção original diretamente: `comCodigoDeFrete` decide se ela recebe
  // o código explícito de erro seguro (ver CODIGO_ERRO_FRETE_MELHOR_ENVIO)
  // antes de propagar. O fluxo de OAuth (trocarCodigoPorToken/conectar) não
  // passa por aqui, então nunca é afetado por essa etiquetagem.
  async cotar(input: MelhorEnvioCotacaoInput): Promise<MelhorEnvioOpcao[]> {
    try {
      return await this.executarCotacao(input);
    } catch (erro) {
      throw this.comCodigoDeFrete(erro);
    }
  }

  // Reconstrói a MESMA classe/status/mensagem da exceção original — só
  // adiciona `code` na resposta HTTP (ver AllExceptionsFilter) quando a
  // exceção capturada for uma das três classes dedicadas deste serviço.
  // Qualquer outra exceção (ex.: InternalServerErrorException genérica de
  // configuração ausente) atravessa sem alteração, continuando a cair no
  // fallback do frontend — nunca vira "segura" por engano.
  private comCodigoDeFrete(erro: unknown): unknown {
    if (erro instanceof MelhorEnvioNaoConectadoError) {
      return new MelhorEnvioNaoConectadoError({
        message: this.extrairMensagem(erro),
        code: CODIGO_ERRO_FRETE_MELHOR_ENVIO,
      });
    }
    if (erro instanceof MelhorEnvioIndisponivelError) {
      return new MelhorEnvioIndisponivelError({
        message: this.extrairMensagem(erro),
        code: CODIGO_ERRO_FRETE_MELHOR_ENVIO,
      });
    }
    if (erro instanceof MelhorEnvioErroHttpError) {
      return new MelhorEnvioErroHttpError({
        message: this.extrairMensagem(erro),
        code: CODIGO_ERRO_FRETE_MELHOR_ENVIO,
      });
    }
    return erro;
  }

  private extrairMensagem(erro: HttpException): string {
    const resposta = erro.getResponse();
    return typeof resposta === 'string'
      ? resposta
      : (resposta as { message: string }).message;
  }

  // Melhor Envio espera `postal_code` só com dígitos — tanto
  // MELHOR_ENVIO_CEP_ORIGEM quanto o CEP salvo em Endereco (Etapa 6.5) podem
  // conter hífen (00000-000, formato também aceito por CreateEnderecoDto),
  // então nenhum dos dois é enviado à API sem passar por aqui antes.
  private normalizarCep(cep: string): string {
    return cep.replace(/\D/g, '');
  }

  private async executarCotacao(
    input: MelhorEnvioCotacaoInput,
  ): Promise<MelhorEnvioOpcao[]> {
    if (!this.userAgent) {
      throw new InternalServerErrorException(
        'MELHOR_ENVIO_USER_AGENT não configurado',
      );
    }
    // CEP de origem é sempre o configurado no backend, nunca recebido do
    // chamador — só o backend decide de onde a loja despacha (Parte 3 da
    // etapa: "CEP de origem configurado no backend").
    if (!this.cepOrigem) {
      throw new InternalServerErrorException(
        'MELHOR_ENVIO_CEP_ORIGEM não configurado',
      );
    }

    const accessToken = await this.garantirAccessToken();

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/v2/me/shipment/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': this.userAgent,
        },
        body: JSON.stringify({
          from: { postal_code: this.normalizarCep(this.cepOrigem) },
          to: { postal_code: this.normalizarCep(input.cepDestino) },
          package: {
            height: input.pacote.alturaCm,
            width: input.pacote.larguraCm,
            length: input.pacote.comprimentoCm,
            weight: input.pacote.pesoGramas / 1000,
          },
          options: {
            insurance_value: input.valorDeclarado,
            receipt: false,
            own_hand: false,
          },
        }),
      });
    } catch {
      throw new MelhorEnvioIndisponivelError(
        'Não foi possível se comunicar com o Melhor Envio',
      );
    }

    if (!response.ok) {
      const corpoErro = await response.text().catch(() => '<corpo ilegível>');
      this.logger.error(
        `Melhor Envio recusou POST /shipment/calculate -> ${response.status} ${response.statusText}: ${corpoErro}`,
      );
      throw new MelhorEnvioErroHttpError('O Melhor Envio recusou a cotação');
    }

    let corpo: unknown;
    try {
      corpo = await response.json();
    } catch {
      throw new MelhorEnvioErroHttpError('Resposta inválida do Melhor Envio');
    }

    if (!Array.isArray(corpo)) {
      throw new MelhorEnvioErroHttpError('Resposta inesperada do Melhor Envio');
    }

    return corpo
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' &&
          item !== null &&
          !(item as { error?: unknown }).error,
      )
      .map((item) => this.paraOpcao(item))
      .filter((opcao): opcao is MelhorEnvioOpcao => opcao !== null);
  }

  // Nunca lança para um item malformado isolado — só o descarta (com log
  // para investigação), para que um formato inesperado de UM serviço não
  // derrube a cotação inteira do carrinho.
  private paraOpcao(item: Record<string, unknown>): MelhorEnvioOpcao | null {
    const id = Number(item.id);
    const preco = Number(item.price);
    const prazoDias = Number(item.delivery_time);
    const company = item.company as { name?: unknown } | undefined;
    const transportadora = company?.name;
    const servico = item.name;

    if (
      !Number.isFinite(id) ||
      !Number.isFinite(preco) ||
      !Number.isFinite(prazoDias) ||
      typeof transportadora !== 'string' ||
      typeof servico !== 'string'
    ) {
      this.logger.warn(
        `Item de cotação do Melhor Envio ignorado por formato inesperado: ${JSON.stringify(item)}`,
      );
      return null;
    }

    return { id, transportadora, servico, preco, prazoDias };
  }
}
