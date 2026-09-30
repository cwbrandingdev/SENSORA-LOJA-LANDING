import {
  BadGatewayException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MelhorEnvioTokenCryptoService } from './melhor-envio-token-crypto.service';

export interface MelhorEnvioPacote {
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
  pesoGramas: number;
}

export interface MelhorEnvioCotacaoInput {
  // Sem cepOrigem, a origem é a loja (MELHOR_ENVIO_CEP_ORIGEM) — o checkout
  // nunca informa. A logística reversa informa o CEP do cliente.
  cepOrigem?: string;
  cepDestino: string;
  pacote: MelhorEnvioPacote;
  valorDeclarado: number;
}

// Etapa 8 — quem devolve o produto (o cliente), remetente da reversa.
export interface MelhorEnvioRemetente {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  rua: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface MelhorEnvioReversaInput {
  servicoId: number;
  remetente: MelhorEnvioRemetente;
  itens: { nome: string; quantidade: number; valorUnitario: number }[];
  pacote: MelhorEnvioPacote;
  valorDeclarado: number;
}

// Situação de um envio no Melhor Envio (GET /api/v2/me/orders/{id}), já nos
// termos do projeto. `status` é o valor cru do Melhor Envio (guardado como
// última situação); pago/gerado/postado já interpretam status + datas.
// codigoDevolucao = `authorization_code` (o código que o cliente apresenta
// nos Correios na logística reversa); codigoRastreio = `tracking` (rastreio
// do objeto). São conceitos diferentes e nunca se substituem.
export interface MelhorEnvioSituacao {
  status: string;
  pago: boolean;
  gerado: boolean;
  postado: boolean;
  pagoEm: Date | null;
  geradoEm: Date | null;
  postadoEm: Date | null;
  codigoDevolucao: string | null;
  codigoRastreio: string | null;
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
// `cotar()` (abaixo, via `comCodigoSeguro`) anexa este código — os mesmos
// erros lançados pelo fluxo de OAuth (trocarCodigoPorToken/conectar) nunca
// o recebem, preservando o comportamento atual desse fluxo. Mantenha o
// valor sincronizado com a constante equivalente em
// frontend-sensora/lib/errors.ts caso precise alterá-lo.
export const CODIGO_ERRO_FRETE_MELHOR_ENVIO = 'FRETE_MELHOR_ENVIO_INDISPONIVEL';

// Etapa 8 — mesmo contrato, para as mensagens seguras da logística reversa
// (criar/comprar/gerar/imprimir/rastrear): sem ele, o ADMIN veria só a
// mensagem genérica em vez de "Saldo insuficiente…". Mantenha sincronizado
// com frontend-sensora/lib/errors.ts.
export const CODIGO_ERRO_LOGISTICA_MELHOR_ENVIO =
  'LOGISTICA_MELHOR_ENVIO_INDISPONIVEL';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// OAuth `state` sem memória local (o backend roda em mais de uma máquina):
// o próprio state carrega {finalidade, nonce, emitido/expira em}, cifrado e
// autenticado com AES-256-GCM pelo MelhorEnvioTokenCryptoService (mesma
// chave já compartilhada pelas máquinas). Qualquer máquina valida; ninguém
// forja nem altera. Nunca carrega client_secret/access_token/refresh_token.
const STATE_FINALIDADE = 'melhor-envio-oauth';
const STATE_VALIDADE_MS = 10 * 60_000;

interface StatePayload {
  f: string; // finalidade — amarra o state a este fluxo OAuth
  n: string; // nonce aleatório (32 bytes)
  i: number; // emitido em (ms)
  e: number; // expira em (ms)
}

// Variáveis que definem o pacote da cotação. O construtor tem valores
// padrão (usados pelo checkout, comportamento inalterado), mas o "Verificar
// agora" só testa com elas EXPLICITAMENTE configuradas — ver
// verificarOperacional.
const VARIAVEIS_PACOTE = [
  'MELHOR_ENVIO_PACOTE_ALTURA_CM',
  'MELHOR_ENVIO_PACOTE_LARGURA_CM',
  'MELHOR_ENVIO_PACOTE_COMPRIMENTO_CM',
  'MELHOR_ENVIO_PACOTE_PESO_GRAMAS',
];

// Mesma mensagem de sempre de executarCotacao — constante só para que
// verificarOperacional a reconheça e mostre a mensagem administrativa.
const MENSAGEM_COTACAO_RECUSADA = 'O Melhor Envio recusou a cotação';

// Renova um pouco antes da expiração real — evita usar um access_token que
// expira no meio de uma requisição em voo.
const MARGEM_EXPIRACAO_MS = 60_000;

// Etapa 8 — escopos pedidos na conexão: cotação (checkout) e o ciclo da
// logística reversa (carrinho, compra, geração do código de devolução,
// consulta do envio e, como recurso secundário, impressão do documento do
// envio). Trocar esta lista exige reconectar a conta.
const ESCOPO_PADRAO = [
  'shipping-calculate',
  'cart-read',
  'cart-write',
  'orders-read',
  'shipping-checkout',
  'shipping-generate',
  'shipping-print',
].join(' ');

// Status do Melhor Envio que já passaram de cada ponto do ciclo.
const STATUS_PAGOS = ['paid', 'released', 'generated', 'posted', 'delivered'];
const STATUS_GERADOS = ['generated', 'posted', 'delivered'];
const STATUS_POSTADOS = ['posted', 'delivered'];

// A logística reversa do Melhor Envio só aceita Correios PAC (1) e SEDEX (2).
const SERVICOS_LOGISTICA_REVERSA = [1, 2];

// Dados da loja (destinatária da reversa). O CEP continua em
// MELHOR_ENVIO_CEP_ORIGEM; LOJA_COMPLEMENTO é o único opcional.
const VARIAVEIS_LOJA = [
  'LOJA_NOME',
  'LOJA_DOCUMENTO',
  'LOJA_TELEFONE',
  'LOJA_EMAIL',
  'LOJA_RUA',
  'LOJA_NUMERO',
  'LOJA_BAIRRO',
  'LOJA_CIDADE',
  'LOJA_UF',
  'MELHOR_ENVIO_CEP_ORIGEM',
];

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
      this.configService.get<string>('MELHOR_ENVIO_SCOPE') ?? ESCOPO_PADRAO;
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
  // "Verificar agora"), nunca automática. Valida exatamente a capacidade de
  // que o Sensora precisa: uma COTAÇÃO via POST /api/v2/me/shipment/calculate
  // (escopo `shipping-calculate`, o único solicitado). Antes usava
  // GET /api/v2/me, que exige `users-read` — fora do escopo do app — e por
  // isso respondia 403 mesmo com a conta conectada corretamente.
  //
  // Reaproveita cotar() inteiro (token, renovação automática, cabeçalhos com
  // Bearer + User-Agent, montagem da requisição e tratamento de erros) —
  // nenhuma lógica duplicada. A cotação de teste vai do CEP de origem para
  // ele mesmo, com o pacote EXPLICITAMENTE configurado e sem seguro (0): não
  // inventa CEP, medidas nem peso, e não cria carrinho/etiqueta nem gera
  // cobrança.
  //
  // Configuração incompleta (sem CEP de origem ou sem alguma medida/peso do
  // pacote nas variáveis de ambiente) NÃO chama o Melhor Envio: responde
  // "configuração incompleta" em vez de testar com os valores padrão de
  // desenvolvimento do construtor. Nunca lança: qualquer falha vira
  // `{ operational: false, mensagem }` com mensagem segura — nunca
  // client_secret/token/corpo cru.
  async verificarOperacional(): Promise<{
    operational: boolean;
    mensagem?: string;
  }> {
    const faltando = ['MELHOR_ENVIO_CEP_ORIGEM', ...VARIAVEIS_PACOTE].filter(
      (nome) => !this.configService.get<string>(nome),
    );
    if (faltando.length > 0) {
      return {
        operational: false,
        mensagem: `Configuração incompleta para testar a cotação: defina ${faltando.join(', ')}.`,
      };
    }

    try {
      const opcoes = await this.cotar({
        cepDestino: this.cepOrigem!,
        pacote: this.pacotePadrao,
        valorDeclarado: 0,
      });
      return {
        operational: true,
        mensagem:
          opcoes.length > 0
            ? `Cotação de teste respondeu com ${opcoes.length} ${opcoes.length === 1 ? 'opção' : 'opções'} de frete. Isso confirma a conexão e a permissão de cotação — não garante frete para todos os destinos.`
            : 'Cotação de teste respondeu sem opções para o CEP de origem. A conexão e a permissão de cotação estão válidas, mas isso não garante frete para todos os destinos.',
      };
    } catch (erro) {
      if (erro instanceof MelhorEnvioErroHttpError) {
        // 401/403 e demais recusas: o status e o corpo de erro já foram
        // registrados (sem token) em executarCotacao — aqui só a mensagem
        // administrativa de sempre.
        return {
          operational: false,
          mensagem:
            this.extrairMensagem(erro) === MENSAGEM_COTACAO_RECUSADA
              ? 'O Melhor Envio recusou a verificação da conexão.'
              : this.extrairMensagem(erro),
        };
      }
      if (erro instanceof MelhorEnvioIndisponivelError) {
        return {
          operational: false,
          mensagem: 'Não foi possível se comunicar com o Melhor Envio.',
        };
      }
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
    const valor = this.emitirState();

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

    const emitidoEm = this.validarState(state);

    // Uso único sem tabela nova: `atualizadoEm` do token salvo (compartilhado
    // por todas as máquinas via banco) marca a última conexão/renovação. Um
    // state emitido ANTES disso já foi usado (ou foi superado por uma conexão
    // mais recente) e é recusado — inclusive o próprio state, depois do
    // primeiro callback bem-sucedido.
    const tokenAtual = await this.prisma.melhorEnvioToken.findUnique({
      where: { id: 1 },
      select: { atualizadoEm: true },
    });
    if (tokenAtual && tokenAtual.atualizadoEm.getTime() >= emitidoEm) {
      throw new MelhorEnvioErroHttpError(
        'state já utilizado — reinicie a conexão com o Melhor Envio',
      );
    }

    const resposta = await this.requestToken({
      grant_type: 'authorization_code',
      client_id: this.clientId!,
      client_secret: this.clientSecret!,
      redirect_uri: this.redirectUri!,
      code,
    });

    await this.persistirToken(resposta);
  }

  private emitirState(): string {
    const agora = Date.now();
    const payload: StatePayload = {
      f: STATE_FINALIDADE,
      n: randomBytes(32).toString('hex'),
      i: agora,
      e: agora + STATE_VALIDADE_MS,
    };
    // base64url: o formato do ciphertext ("v1:iv:tag:dados", base64 comum)
    // tem ':' '+' '/' '=' — vira um valor seguro para ir e voltar na URL.
    return Buffer.from(
      this.tokenCrypto.encrypt(JSON.stringify(payload)),
      'utf8',
    ).toString('base64url');
  }

  // Devolve o instante de emissão do state válido; qualquer problema
  // (forjado, adulterado, de outro fluxo, expirado) vira a mesma recusa.
  private validarState(state: string | undefined): number {
    const invalido = () =>
      new MelhorEnvioErroHttpError(
        'state inválido ou expirado — reinicie a conexão com o Melhor Envio',
      );
    if (!state) throw invalido();

    const cifrado = Buffer.from(state, 'base64url').toString('utf8');
    if (!cifrado.startsWith('v1:')) throw invalido();

    let payload: Partial<StatePayload>;
    try {
      payload = JSON.parse(
        this.tokenCrypto.decrypt(cifrado),
      ) as Partial<StatePayload>;
    } catch {
      throw invalido();
    }

    if (
      payload.f !== STATE_FINALIDADE ||
      typeof payload.i !== 'number' ||
      typeof payload.e !== 'number' ||
      payload.e < Date.now()
    ) {
      throw invalido();
    }
    return payload.i;
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
  private async persistirToken(
    resposta: TokenResponse,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + resposta.expires_in * 1000);
    const accessTokenCriptografado = this.tokenCrypto.encrypt(
      resposta.access_token,
    );
    const refreshTokenCriptografado = this.tokenCrypto.encrypt(
      resposta.refresh_token,
    );
    await client.melhorEnvioToken.upsert({
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

    if (!this.expirando(token.expiresAt)) {
      return this.tokenCrypto.decrypt(token.accessToken);
    }

    // Renova ANTES de qualquer chamada de cotação, nunca reativamente após
    // um 401 — evita depender de retry específico de status na chamada de
    // cotação em si.
    //
    // Etapa 8 — a renovação trava a linha do token até gravar o novo: duas
    // requisições simultâneas com o token vencendo renovam uma de cada vez,
    // e a segunda, ao reler, já encontra o token novo e não renova de novo
    // (o refresh_token antigo deixa de valer depois de usado).
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "MelhorEnvioToken" WHERE id = 1 FOR UPDATE`;
        const atual = await tx.melhorEnvioToken.findUnique({
          where: { id: 1 },
        });
        if (!atual) {
          throw new MelhorEnvioNaoConectadoError(
            'A loja ainda não está conectada ao Melhor Envio.',
          );
        }
        if (!this.expirando(atual.expiresAt)) {
          return this.tokenCrypto.decrypt(atual.accessToken);
        }

        const resposta = await this.requestToken({
          grant_type: 'refresh_token',
          client_id: this.clientId!,
          client_secret: this.clientSecret!,
          refresh_token: this.tokenCrypto.decrypt(atual.refreshToken),
        });
        await this.persistirToken(resposta, tx);
        return resposta.access_token;
      },
      // A transação espera a resposta do /oauth/token.
      { timeout: 20_000 },
    );
  }

  private expirando(expiresAt: Date): boolean {
    return expiresAt.getTime() - MARGEM_EXPIRACAO_MS <= Date.now();
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
          // Exigido pela API em toda requisição — vale para a troca do code
          // e para a renovação via refresh_token (ambas passam por aqui).
          ...(this.userAgent ? { 'User-Agent': this.userAgent } : {}),
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
  // a exceção original diretamente: `comCodigoSeguro` decide se ela recebe
  // o código explícito de erro seguro (ver CODIGO_ERRO_FRETE_MELHOR_ENVIO)
  // antes de propagar. O fluxo de OAuth (trocarCodigoPorToken/conectar) não
  // passa por aqui, então nunca é afetado por essa etiquetagem.
  async cotar(input: MelhorEnvioCotacaoInput): Promise<MelhorEnvioOpcao[]> {
    try {
      return await this.executarCotacao(input);
    } catch (erro) {
      throw this.comCodigoSeguro(erro, CODIGO_ERRO_FRETE_MELHOR_ENVIO);
    }
  }

  // Reconstrói a MESMA classe/status/mensagem da exceção original — só
  // adiciona `code` na resposta HTTP (ver AllExceptionsFilter) quando a
  // exceção capturada for uma das três classes dedicadas deste serviço.
  // Qualquer outra exceção (ex.: InternalServerErrorException genérica de
  // configuração ausente) atravessa sem alteração, continuando a cair no
  // fallback do frontend — nunca vira "segura" por engano.
  private comCodigoSeguro(erro: unknown, code: string): unknown {
    if (erro instanceof MelhorEnvioNaoConectadoError) {
      return new MelhorEnvioNaoConectadoError({
        message: this.extrairMensagem(erro),
        code,
      });
    }
    if (erro instanceof MelhorEnvioIndisponivelError) {
      return new MelhorEnvioIndisponivelError({
        message: this.extrairMensagem(erro),
        code,
      });
    }
    if (erro instanceof MelhorEnvioErroHttpError) {
      return new MelhorEnvioErroHttpError({
        message: this.extrairMensagem(erro),
        code,
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
          from: {
            postal_code: this.normalizarCep(input.cepOrigem ?? this.cepOrigem),
          },
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
      // Só rota e status: o corpo pode repetir dados da requisição (CEP do
      // cliente na cotação da logística reversa).
      this.logger.error(
        `Melhor Envio recusou POST /shipment/calculate -> ${response.status} ${response.statusText}`,
      );
      throw new MelhorEnvioErroHttpError(MENSAGEM_COTACAO_RECUSADA);
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

  // ---- Logística reversa (Etapa 8) -----------------------------------------
  //
  // Na logística reversa dos Correios o cliente NÃO usa etiqueta: apresenta
  // na agência o código de devolução (`authorization_code`). Ciclo: criar a
  // reversa no carrinho (POST /api/v2/me/cart/reverse) -> comprar com o saldo
  // da carteira (/shipment/checkout) -> gerar (/shipment/generate, é o que
  // libera o código) -> consultar (GET /orders/{id}: código de devolução,
  // rastreio, datas). A impressão (/shipment/print) é só um recurso
  // secundário. Cada método faz UMA chamada; quem decide a ordem e o que já
  // foi feito é DevolucoesService. Os payloads do Melhor Envio ficam só aqui.
  // Erros nunca registram o corpo da resposta (pode repetir CPF/endereço do
  // cliente) — só rota e status.

  // Nomes (nunca valores) das variáveis da loja que ainda faltam.
  get dadosLojaFaltando(): string[] {
    return VARIAVEIS_LOJA.filter(
      (nome) => !this.configService.get<string>(nome)?.trim(),
    );
  }

  // Mesmo pacote do checkout: o padrão, com o peso escalado pela quantidade.
  pacoteParaQuantidade(quantidade: number): MelhorEnvioPacote {
    return {
      ...this.pacotePadrao,
      pesoGramas: this.pacotePadrao.pesoGramas * Math.max(quantidade, 1),
    };
  }

  // Cotação do cliente (origem) para a loja (destino), só com os serviços
  // que a reversa aceita.
  async cotarReversa(
    cepCliente: string,
    pacote: MelhorEnvioPacote,
    valorDeclarado: number,
  ): Promise<MelhorEnvioOpcao[]> {
    const opcoes = await this.cotar({
      cepOrigem: cepCliente,
      cepDestino: this.cepOrigem ?? '',
      pacote,
      valorDeclarado,
    });
    return opcoes.filter((opcao) =>
      SERVICOS_LOGISTICA_REVERSA.includes(opcao.id),
    );
  }

  // Cria a reversa no carrinho do Melhor Envio (ainda sem cobrança).
  // Devolve o id do envio e o preço do item no carrinho (`price`, o valor
  // que a compra vai debitar). Um `service_id` diferente do pedido é recusado
  // antes de qualquer cobrança.
  async criarReversa(
    input: MelhorEnvioReversaInput,
  ): Promise<{ id: string; preco: number | null }> {
    const faltando = this.dadosLojaFaltando;
    if (faltando.length > 0) {
      throw new InternalServerErrorException(
        `Dados da loja incompletos: defina ${faltando.join(', ')}.`,
      );
    }
    const loja = (nome: string) => this.configService.get<string>(nome)!.trim();
    const documentoLoja = loja('LOJA_DOCUMENTO').replace(/\D/g, '');
    const { remetente, pacote } = input;

    const resposta = await this.chamarApi('POST', '/api/v2/me/cart/reverse', {
      service: input.servicoId,
      new_sender_mail: remetente.email,
      new_sender_phone: remetente.telefone,
      insurance_value: input.valorDeclarado,
      from: {
        name: remetente.nome,
        document: remetente.cpf,
        phone: remetente.telefone,
        email: remetente.email,
        address: remetente.rua,
        number: remetente.numero,
        ...(remetente.complemento ? { complement: remetente.complemento } : {}),
        district: remetente.bairro,
        city: remetente.cidade,
        state_abbr: remetente.uf,
        postal_code: this.normalizarCep(remetente.cep),
        country_id: 'BR',
      },
      to: {
        name: loja('LOJA_NOME'),
        // CNPJ vai em company_document; CPF em document.
        ...(documentoLoja.length === 14
          ? { company_document: documentoLoja }
          : { document: documentoLoja }),
        phone: loja('LOJA_TELEFONE'),
        email: loja('LOJA_EMAIL'),
        address: loja('LOJA_RUA'),
        number: loja('LOJA_NUMERO'),
        ...(this.configService.get<string>('LOJA_COMPLEMENTO')?.trim()
          ? { complement: loja('LOJA_COMPLEMENTO') }
          : {}),
        district: loja('LOJA_BAIRRO'),
        city: loja('LOJA_CIDADE'),
        state_abbr: loja('LOJA_UF'),
        postal_code: this.normalizarCep(loja('MELHOR_ENVIO_CEP_ORIGEM')),
        country_id: 'BR',
      },
      products: input.itens.map((item) => ({
        name: item.nome,
        quantity: item.quantidade,
        unitary_value: item.valorUnitario,
        weight: this.pacotePadrao.pesoGramas / 1000,
      })),
      package: {
        height: pacote.alturaCm,
        width: pacote.larguraCm,
        length: pacote.comprimentoCm,
        weight: pacote.pesoGramas / 1000,
      },
      options: { own_hand: false, receipt: false },
    });

    if (!resposta.ok) {
      throw this.falha(
        'POST /cart/reverse',
        resposta.status,
        `O Melhor Envio recusou a criação da logística reversa (HTTP ${resposta.status}). Confira os dados do cliente e da loja.`,
      );
    }
    const corpo = resposta.corpo as {
      id?: unknown;
      price?: unknown;
      service_id?: unknown;
    } | null;
    if (typeof corpo?.id !== 'string' || !corpo.id) {
      throw this.erroLogistica('Resposta inesperada do Melhor Envio');
    }
    if (
      corpo.service_id !== undefined &&
      corpo.service_id !== null &&
      Number(corpo.service_id) !== input.servicoId
    ) {
      this.logger.error(
        `Melhor Envio criou a reversa ${corpo.id} com o serviço ${JSON.stringify(corpo.service_id)} em vez de ${input.servicoId}`,
      );
      throw this.erroLogistica(
        'O Melhor Envio criou o envio com outro serviço de frete. Nada foi cobrado; tente novamente.',
      );
    }
    const preco = Number(corpo.price);
    return { id: corpo.id, preco: Number.isFinite(preco) ? preco : null };
  }

  // Compra o envio com o saldo da carteira. "Já foi pago" conta como sucesso
  // (o Melhor Envio nunca cobra o mesmo envio duas vezes).
  async comprarEnvio(id: string): Promise<void> {
    const resposta = await this.chamarApi(
      'POST',
      '/api/v2/me/shipment/checkout',
      { orders: [id] },
    );
    if (resposta.ok) {
      return;
    }
    const texto = JSON.stringify(resposta.corpo ?? '');
    if (/já foram pagas|already paid/i.test(texto)) {
      return;
    }
    if (/saldo|balance/i.test(texto)) {
      this.logger.error(
        `Melhor Envio recusou POST /shipment/checkout -> ${resposta.status} (saldo insuficiente)`,
      );
      throw this.erroLogistica(
        'Saldo insuficiente na carteira do Melhor Envio para comprar o envio da devolução.',
      );
    }
    throw this.falha(
      'POST /shipment/checkout',
      resposta.status,
      'O Melhor Envio recusou a compra do envio da devolução.',
    );
  }

  // Gera o envio já pago. Na reversa é esta geração que libera o código de
  // devolução (lido depois em consultarEnvio).
  async gerarEnvio(id: string): Promise<void> {
    const resposta = await this.chamarApi(
      'POST',
      '/api/v2/me/shipment/generate',
      { orders: [id] },
    );
    const resultado = (
      resposta.corpo as Record<string, { status?: unknown }> | null
    )?.[id];
    if (!resposta.ok || resultado?.status !== true) {
      throw this.falha(
        'POST /shipment/generate',
        resposta.status,
        'O Melhor Envio não gerou o código de devolução.',
      );
    }
  }

  // Recurso secundário: URL do documento do envio (impressão do Melhor
  // Envio), gerada agora. Modo público: o cliente abre sem ter conta no
  // Melhor Envio. Nunca é guardada — quem chama só repassa.
  async urlImpressao(id: string): Promise<string> {
    const resposta = await this.chamarApi('POST', '/api/v2/me/shipment/print', {
      mode: 'public',
      orders: [id],
    });
    const url = (resposta.corpo as { url?: unknown } | null)?.url;
    if (
      !resposta.ok ||
      typeof url !== 'string' ||
      !url.startsWith('https://')
    ) {
      throw this.falha(
        'POST /shipment/print',
        resposta.status,
        'O Melhor Envio não devolveu o documento do envio.',
      );
    }
    return url;
  }

  // Situação atual do envio (pago? gerado? postado? código de devolução e
  // rastreio) — usada antes de repetir a compra ou a geração e para
  // atualizar o rastreio. GET /orders/{id} é o único endpoint documentado
  // que devolve o `authorization_code`.
  async consultarEnvio(id: string): Promise<MelhorEnvioSituacao> {
    const resposta = await this.chamarApi(
      'GET',
      `/api/v2/me/orders/${encodeURIComponent(id)}`,
    );
    if (!resposta.ok) {
      throw this.falha(
        'GET /orders/:id',
        resposta.status,
        'Não foi possível consultar o envio no Melhor Envio.',
      );
    }
    return this.paraSituacao(resposta.corpo);
  }

  // Chamada autenticada genérica. Não lança por status HTTP (quem chama
  // decide); lança só por falha de rede, conexão ou configuração.
  private async chamarApi(
    metodo: 'GET' | 'POST',
    caminho: string,
    corpo?: unknown,
  ): Promise<{ ok: boolean; status: number; corpo: unknown }> {
    if (!this.userAgent) {
      throw new InternalServerErrorException(
        'MELHOR_ENVIO_USER_AGENT não configurado',
      );
    }
    let accessToken: string;
    try {
      accessToken = await this.garantirAccessToken();
    } catch (erro) {
      throw this.comCodigoSeguro(erro, CODIGO_ERRO_LOGISTICA_MELHOR_ENVIO);
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${caminho}`, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': this.userAgent,
        },
        ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
      });
    } catch {
      throw new MelhorEnvioIndisponivelError({
        message: 'Não foi possível se comunicar com o Melhor Envio',
        code: CODIGO_ERRO_LOGISTICA_MELHOR_ENVIO,
      });
    }

    const dados: unknown = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, corpo: dados };
  }

  // Registra só rota e status (nunca o corpo) e devolve o erro seguro.
  private falha(
    rota: string,
    status: number,
    mensagem: string,
  ): MelhorEnvioErroHttpError {
    this.logger.error(`Melhor Envio recusou ${rota} -> ${status}`);
    return this.erroLogistica(mensagem);
  }

  // Erro com mensagem segura, que o frontend pode mostrar ao ADMIN.
  private erroLogistica(mensagem: string): MelhorEnvioErroHttpError {
    return new MelhorEnvioErroHttpError({
      message: mensagem,
      code: CODIGO_ERRO_LOGISTICA_MELHOR_ENVIO,
    });
  }

  private paraSituacao(dados: unknown): MelhorEnvioSituacao {
    const envio = (dados ?? {}) as Record<string, unknown>;
    const texto = (valor: unknown) =>
      typeof valor === 'string' && valor ? valor : null;
    const status = texto(envio.status) ?? 'desconhecido';
    const pagoEm = this.paraData(envio.paid_at);
    const geradoEm = this.paraData(envio.generated_at);
    const postadoEm = this.paraData(envio.posted_at);
    return {
      status,
      pago: pagoEm !== null || STATUS_PAGOS.includes(status),
      gerado: geradoEm !== null || STATUS_GERADOS.includes(status),
      postado: postadoEm !== null || STATUS_POSTADOS.includes(status),
      pagoEm,
      geradoEm,
      postadoEm,
      codigoDevolucao: texto(envio.authorization_code),
      codigoRastreio: texto(envio.tracking),
    };
  }

  // O Melhor Envio devolve "AAAA-MM-DD HH:MM:SS" sem fuso — horário de
  // Brasília (-03:00).
  private paraData(valor: unknown): Date | null {
    if (typeof valor !== 'string' || !valor) {
      return null;
    }
    const data = new Date(`${valor.replace(' ', 'T')}-03:00`);
    return Number.isNaN(data.getTime()) ? null : data;
  }
}
