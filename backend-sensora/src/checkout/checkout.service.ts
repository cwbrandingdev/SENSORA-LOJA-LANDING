import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import Stripe from 'stripe';
import { AsaasService } from '../asaas/asaas.service';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../produtos/produtos.service';
import { EnderecosService } from '../enderecos/enderecos.service';
import { Endereco } from '../enderecos/entities/endereco.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import {
  MelhorEnvioPacote,
  MelhorEnvioService,
} from '../melhor-envio/melhor-envio.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { CotarFreteDto } from './dto/cotar-frete.dto';
import {
  CheckoutSessionResponse,
  CheckoutSessionStatus,
} from './entities/checkout-session.entity';
import { OpcaoFreteResponse } from './entities/opcao-frete.entity';

type CheckoutGateway = 'asaas' | 'stripe';
type PedidoCriado = Awaited<ReturnType<PrismaService['pedido']['create']>>;

interface ItemSelecionado {
  nome: string;
  descricao?: string;
  aroma?: string;
  imagemUrl?: string;
  preco: number;
  quantidade: number;
}

// Compara em tempo constante para não vazar, via timing, quantos caracteres
// do token recebido batem com o configurado (mesmo raciocínio de qualquer
// comparação de segredo — aqui não é HMAC como no Stripe porque o Asaas usa
// um token estático, comparado por igualdade, no header `asaas-access-token`).
function tokensIguais(recebido: string, esperado: string): boolean {
  const bufA = Buffer.from(recebido);
  const bufB = Buffer.from(esperado);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly gateway: CheckoutGateway;
  private readonly frontendUrl: string;
  // Legado (Task 21) — só instanciado no modo de rollback
  // (CHECKOUT_GATEWAY="stripe"). Preservado exatamente como na integração
  // original (Task 15): é o caminho que garante que voltar para o Stripe
  // continua funcionando se o Asaas precisar ser revertido.
  private readonly stripe?: Stripe;

  // Etapa 5B.5 — eventos de webhook do Asaas relacionados a reembolso.
  // PAYMENT_REFUNDED é o único que confirma reembolso completo (ver
  // processarEventoReembolsoAsaas); os outros três só existem aqui para
  // serem reconhecidos e registrados — nenhum deles altera Pedido/estoque.
  private static readonly EVENTOS_REEMBOLSO_ASAAS = new Set([
    'PAYMENT_REFUND_IN_PROGRESS',
    'PAYMENT_REFUNDED',
    'PAYMENT_PARTIALLY_REFUNDED',
    'PAYMENT_REFUND_DENIED',
  ]);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly produtosService: ProdutosService,
    private readonly enderecosService: EnderecosService,
    private readonly asaasService: AsaasService,
    private readonly usuariosService: UsuariosService,
    private readonly melhorEnvioService: MelhorEnvioService,
  ) {
    this.gateway =
      (this.configService.get<string>('CHECKOUT_GATEWAY') as
        CheckoutGateway | undefined) ?? 'asaas';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';

    if (this.gateway === 'stripe') {
      const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
      if (!secretKey) {
        throw new Error('STRIPE_SECRET_KEY não configurada');
      }
      this.stripe = new Stripe(secretKey);
    }
  }

  async createSession(
    dto: CreateCheckoutSessionDto,
    usuarioId: number,
  ): Promise<CheckoutSessionResponse> {
    // Etapa 6.4 (Confirmação de e-mail, decisão aprovada) — checkout bloqueado
    // para quem ainda não confirmou o e-mail. Consulta o estado REAL no
    // banco a cada chamada (nunca um claim do JWT/valor vindo do frontend) —
    // usuariosService.findOne já busca fresco do Prisma, mesmo raciocínio de
    // JwtStrategy.validate() nunca confiar só no payload do token.
    const usuario = await this.usuariosService.findOne(usuarioId);
    if (!usuario.emailVerificado) {
      throw new ForbiddenException(
        'Confirme seu e-mail para finalizar a compra.',
      );
    }

    if (!dto.itens.length) {
      throw new BadRequestException('O carrinho está vazio');
    }

    // Task 15 (achado da auditoria, resolvido na Etapa 6.5): valida que o
    // endereço existe e pertence a este usuário (404 caso contrário) — a
    // partir daqui, além de validar, o endereço TAMBÉM é persistido como
    // snapshot no Pedido (ver pedido abaixo) e usado como CEP de destino da
    // cotação de frete.
    const endereco = await this.enderecosService.findOneForUsuario(
      dto.enderecoId,
      usuarioId,
    );

    let subtotal = 0;
    let quantidadeTotal = 0;
    const itensPedido: {
      produtoId: number;
      quantidade: number;
      precoUnitario: number;
      subtotal: number;
      estoqueBaixado: boolean;
    }[] = [];
    const itensSelecionados: ItemSelecionado[] = [];

    for (const item of dto.itens) {
      const produto = await this.produtosService.findOne(item.produtoId);

      // Task 16 (aprovado): findOne acha o produto mesmo se `ativo: false`
      // (é a busca "de admin", sem filtro — ver ProdutosService), então sem
      // esta checagem um produto desativado depois de já estar no carrinho
      // do cliente passaria pelo checkout normalmente. Mesmo padrão de
      // BadRequestException do erro de estoque logo abaixo.
      if (!produto.ativo) {
        throw new BadRequestException(
          `Produto "${produto.nome}" não está mais disponível`,
        );
      }

      if (produto.quantidade < item.quantidade) {
        throw new BadRequestException(
          `Estoque insuficiente para "${produto.nome}"`,
        );
      }

      const itemSubtotal = produto.preco * item.quantidade;
      subtotal += itemSubtotal;
      quantidadeTotal += item.quantidade;
      itensPedido.push({
        produtoId: produto.id,
        quantidade: item.quantidade,
        precoUnitario: produto.preco,
        subtotal: itemSubtotal,
        // Etapa 5A.2 (achado da auditoria 5A.1) — explícito, nunca implícito:
        // este método NUNCA decrementa estoque (só valida), então o item
        // nasce com estoqueBaixado:false. Só confirmarPagamento (abaixo)
        // decrementa de fato e atualiza este campo para true.
        estoqueBaixado: false,
      });
      itensSelecionados.push({
        nome: produto.nome,
        descricao: produto.descricao,
        aroma: produto.aroma,
        imagemUrl: produto.imagemUrl,
        preco: produto.preco,
        quantidade: item.quantidade,
      });
    }

    // Etapa 6.5 (Frete), Parte 4 — a opção de frete é sempre RECALCULADA
    // aqui contra o Melhor Envio, nunca aceita a partir do preço/prazo que
    // o cliente possa ter guardado da cotação anterior: o frontend só manda
    // `freteServicoId` (CreateCheckoutSessionDto), e é este método quem
    // resolve o preço oficial. Mesmo princípio de nunca confiar em
    // preço/estoque vindo do cliente já aplicado a produto, acima.
    const opcaoFrete = await this.validarFreteEscolhido(
      endereco,
      dto.freteServicoId,
      subtotal,
      quantidadeTotal,
    );
    itensSelecionados.push({
      nome: `Frete - ${opcaoFrete.transportadora} ${opcaoFrete.servico}`,
      preco: opcaoFrete.preco,
      quantidade: 1,
    });
    const total = subtotal + opcaoFrete.preco;

    const numero = `PED-${Date.now()}`;
    const pedido = await this.prisma.pedido.create({
      data: {
        numero,
        data: new Date(),
        status: StatusPedido.PENDENTE,
        total,
        clienteEmail: dto.clienteEmail,
        clienteNome: dto.clienteNome,
        usuarioId,
        // Etapa 6.5 (Frete), Parte 1 — snapshot do endereço usado NESTA
        // compra, copiado de `endereco` (nunca lido de volta de Endereco
        // depois de criado, ver comentário no schema.prisma).
        enderecoCep: endereco.cep,
        enderecoRua: endereco.rua,
        enderecoNumero: endereco.numero,
        enderecoComplemento: endereco.complemento ?? null,
        enderecoBairro: endereco.bairro,
        enderecoCidade: endereco.cidade,
        enderecoEstado: endereco.estado,
        // Etapa 6.5 (Frete), Parte 1 — resultado já validado da cotação
        // (nunca o preço/prazo enviados pelo cliente).
        freteValor: opcaoFrete.preco,
        freteTransportadora: opcaoFrete.transportadora,
        freteServico: opcaoFrete.servico,
        fretePrazoDias: opcaoFrete.prazoDias,
        freteServicoId: opcaoFrete.id,
        itens: {
          create: itensPedido,
        },
      },
    });

    return this.gateway === 'stripe'
      ? this.criarSessaoStripe(dto, pedido, itensSelecionados)
      : this.criarSessaoAsaas(pedido, itensSelecionados);
  }

  // Etapa 6.5 (Frete), Parte 3 — POST /checkout/frete/cotacao. Mesmo
  // raciocínio de segurança de createSession: recebe só produtoId+
  // quantidade+enderecoId (nunca peso/preço/dimensão do frontend), recarrega
  // os produtos reais para o valor declarado e devolve só o necessário para
  // o cliente escolher (nunca dados internos do Melhor Envio).
  async cotarFrete(
    dto: CotarFreteDto,
    usuarioId: number,
  ): Promise<OpcaoFreteResponse[]> {
    if (!dto.itens.length) {
      throw new BadRequestException('O carrinho está vazio');
    }

    const endereco = await this.enderecosService.findOneForUsuario(
      dto.enderecoId,
      usuarioId,
    );

    let subtotal = 0;
    let quantidadeTotal = 0;
    for (const item of dto.itens) {
      const produto = await this.produtosService.findOne(item.produtoId);
      subtotal += produto.preco * item.quantidade;
      quantidadeTotal += item.quantidade;
    }

    return this.cotarOpcoes(endereco, subtotal, quantidadeTotal);
  }

  // Recotiza contra o Melhor Envio e resolve `freteServicoId` entre as
  // opções REALMENTE disponíveis agora — nunca aceita o preço/prazo/
  // transportadora que o cliente possa ter guardado de uma cotação
  // anterior. Cobre tanto "nenhuma opção disponível" quanto "esta opção
  // específica não está mais entre as disponíveis" com o mesmo erro: do
  // ponto de vista do cliente, é a mesma situação (precisa cotar de novo).
  private async validarFreteEscolhido(
    endereco: Pick<Endereco, 'cep'>,
    freteServicoId: number,
    subtotal: number,
    quantidadeTotal: number,
  ): Promise<OpcaoFreteResponse> {
    const opcoes = await this.cotarOpcoes(endereco, subtotal, quantidadeTotal);
    const opcao = opcoes.find((item) => item.id === freteServicoId);
    if (!opcao) {
      throw new BadRequestException(
        'Opção de frete indisponível. Atualize a cotação e tente novamente.',
      );
    }
    return opcao;
  }

  private async cotarOpcoes(
    endereco: Pick<Endereco, 'cep'>,
    subtotal: number,
    quantidadeTotal: number,
  ): Promise<OpcaoFreteResponse[]> {
    const opcoes = await this.melhorEnvioService.cotar({
      cepDestino: endereco.cep,
      pacote: this.calcularPacote(quantidadeTotal),
      valorDeclarado: subtotal,
    });
    return opcoes.map((opcao) => ({ ...opcao }));
  }

  // Etapa 6.5 (achado da auditoria 6.5) — Produto não tem peso/dimensões
  // modelados (fora do escopo desta etapa alterar o cadastro de produto).
  // Pacote único e configurável (MelhorEnvioService.pacotePadraoConfigurado)
  // para o carrinho inteiro, com o peso escalado pela quantidade total de
  // itens — limitação conhecida, documentada no relatório final da etapa.
  private calcularPacote(quantidadeTotal: number): MelhorEnvioPacote {
    const pacotePadrao = this.melhorEnvioService.pacotePadraoConfigurado;
    return {
      ...pacotePadrao,
      pesoGramas: pacotePadrao.pesoGramas * Math.max(quantidadeTotal, 1),
    };
  }

  private async criarSessaoStripe(
    dto: CreateCheckoutSessionDto,
    pedido: PedidoCriado,
    itens: ItemSelecionado[],
  ): Promise<CheckoutSessionResponse> {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = itens.map(
      (item) => ({
        price_data: {
          currency: 'brl',
          product_data: {
            name: item.nome,
            description: item.aroma ?? item.descricao ?? undefined,
            images: item.imagemUrl ? [item.imagemUrl] : undefined,
          },
          unit_amount: Math.round(item.preco * 100),
        },
        quantity: item.quantidade,
      }),
    );

    const session = await this.stripe!.checkout.sessions.create({
      mode: 'payment',
      customer_email: dto.clienteEmail,
      line_items: lineItems,
      success_url: `${this.frontendUrl}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.frontendUrl}/checkout/cancelado`,
      metadata: {
        pedidoId: String(pedido.id),
        pedidoNumero: pedido.numero,
      },
    });

    await this.prisma.pedido.update({
      where: { id: pedido.id },
      data: { stripeSessionId: session.id },
    });

    if (!session.url) {
      throw new BadRequestException('Não foi possível iniciar o pagamento');
    }

    return { sessionId: session.id, url: session.url };
  }

  // Task 21 — caminho ativo por padrão (CHECKOUT_GATEWAY="asaas"). Cria o
  // Pedido primeiro (igual ao caminho Stripe) e só então abre o Asaas
  // Checkout, usando `externalReference` para amarrar o checkout ao pedido
  // — é essa referência que o webhook usa para reconciliar o pagamento
  // (mesmo papel que `metadata.pedidoId` cumpria no lado Stripe).
  private async criarSessaoAsaas(
    pedido: PedidoCriado,
    itens: ItemSelecionado[],
  ): Promise<CheckoutSessionResponse> {
    const checkout = await this.asaasService.criarCheckout({
      billingTypes: ['PIX', 'CREDIT_CARD'],
      chargeTypes: ['DETACHED'],
      items: itens.map((item) => ({
        name: item.nome,
        quantity: item.quantidade,
        value: item.preco,
      })),
      callback: {
        successUrl: `${this.frontendUrl}/checkout/sucesso`,
        cancelUrl: `${this.frontendUrl}/checkout/cancelado`,
      },
      externalReference: String(pedido.id),
    });

    await this.prisma.pedido.update({
      where: { id: pedido.id },
      data: { asaasCheckoutId: checkout.id },
    });

    if (!checkout.link) {
      throw new BadRequestException('Não foi possível iniciar o pagamento');
    }

    return { sessionId: checkout.id, url: checkout.link };
  }

  async getSessionStatus(
    sessionId: string,
    user: UsuarioAutenticado,
  ): Promise<CheckoutSessionStatus> {
    if (this.gateway === 'stripe') {
      const session = await this.stripe!.checkout.sessions.retrieve(sessionId);
      const pedido = await this.prisma.pedido.findUnique({
        where: { stripeSessionId: sessionId },
      });
      this.garantirSessaoAcessivel(pedido, user);
      return {
        sessionId,
        status: session.payment_status,
        pedidoId: pedido?.id,
        pedidoNumero: pedido?.numero,
      };
    }

    const pedido = await this.prisma.pedido.findUnique({
      where: { asaasCheckoutId: sessionId },
    });
    this.garantirSessaoAcessivel(pedido, user);

    // Achado da auditoria (Etapa 2, testado contra o Asaas Sandbox real):
    // um Checkout do Asaas já convertido em Payment (ou seja, exatamente o
    // caso de quem acabou de pagar e chegou em /checkout/sucesso) deixa de
    // ser servido por GET /checkouts/{id} — a API do Asaas responde 404
    // mesmo para o dono legítimo, o que o AsaasService traduz em
    // BadGatewayException aqui. Depender do Asaas para "status" quebraria
    // exatamente o caso de uso que este endpoint passou a servir (confirmar
    // pagamento aprovado antes de esvaziar o carrinho). Pedido.status já é
    // a fonte de verdade real (mantida pelo webhook CHECKOUT_PAID, nunca
    // expira) — só cai para consultar o Asaas diretamente se não houver
    // NENHUM pedido vinculado a este sessionId (não deveria acontecer no
    // fluxo normal).
    if (pedido) {
      return {
        sessionId,
        status: pedido.status,
        pedidoId: pedido.id,
        pedidoNumero: pedido.numero,
      };
    }

    const checkout = await this.asaasService.consultarCheckout(sessionId);
    return {
      sessionId,
      status: checkout.status,
      pedidoId: undefined,
      pedidoNumero: undefined,
    };
  }

  // Achado da auditoria (Etapa 2): faltava checagem de ownership aqui —
  // qualquer autenticado (JwtAuthGuard) podia consultar QUALQUER sessionId e
  // receber pedidoId/pedidoNumero/status de um pedido de outro usuário. Sem
  // pedido vinculado (`pedido` null) não há nada de ninguém para proteger —
  // segue liberado, igual ao comportamento já existente. Mesmo padrão de
  // PedidosService.podeAcessar/findOne (404 genérico, nunca revela se o
  // sessionId existe ou só não é seu).
  private garantirSessaoAcessivel(
    pedido: { usuarioId: number | null } | null,
    user: UsuarioAutenticado,
  ): void {
    if (!pedido) {
      return;
    }
    if (user.perfil !== PerfilUsuario.ADMIN && pedido.usuarioId !== user.id) {
      throw new NotFoundException('Sessão de checkout não encontrada');
    }
  }

  async handleWebhook(
    headers: { stripeSignature?: string; asaasAccessToken?: string },
    rawBody: Buffer,
  ): Promise<{ received: boolean }> {
    return this.gateway === 'stripe'
      ? this.handleWebhookStripe(headers.stripeSignature, rawBody)
      : this.handleWebhookAsaas(headers.asaasAccessToken, rawBody);
  }

  // Task 15 — único ponto de entrada do webhook do Stripe (legado, modo de
  // rollback). A assinatura (`stripe-signature` + STRIPE_WEBHOOK_SECRET) é
  // a ÚNICA coisa que prova que este payload veio mesmo do Stripe: sem uma
  // assinatura válida, o corpo da requisição não é lido como evento de
  // verdade em nenhuma circunstância — stripe.webhooks.constructEvent lança
  // se a assinatura não bater byte a byte com o rawBody recebido (payload
  // adulterado, assinatura forjada, ou assinada com o secret errado).
  private async handleWebhookStripe(
    signature: string | undefined,
    rawBody: Buffer,
  ): Promise<{ received: boolean }> {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET não configurada');
    }

    let event: Stripe.Event;
    try {
      event = this.stripe!.webhooks.constructEvent(
        rawBody,
        signature ?? '',
        webhookSecret,
      );
    } catch {
      throw new BadRequestException('Assinatura do webhook inválida');
    }

    // Único evento que confirma pagamento concluído no fluxo de Stripe
    // Checkout usado por este projeto (mode: 'payment') — qualquer outro
    // tipo de evento é ignorado com segurança: não marca pedido como pago,
    // não altera estoque.
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      await this.confirmarPagamento({ stripeSessionId: session.id });
    }

    return { received: true };
  }

  // Task 21 — único ponto de entrada do webhook do Asaas. Diferente do
  // Stripe, o Asaas não assina o corpo (HMAC): ele só reenvia, em toda
  // chamada, o token configurado no painel do Asaas via o header
  // `asaas-access-token`. Comparação em tempo constante (tokensIguais)
  // contra ASAAS_WEBHOOK_TOKEN é a única coisa que prova que a chamada veio
  // do Asaas — sem ela batendo, o corpo nunca é interpretado como evento
  // real.
  private async handleWebhookAsaas(
    token: string | undefined,
    rawBody: Buffer,
  ): Promise<{ received: boolean }> {
    const webhookToken = this.configService.get<string>('ASAAS_WEBHOOK_TOKEN');
    if (!webhookToken) {
      throw new BadRequestException('ASAAS_WEBHOOK_TOKEN não configurada');
    }
    if (!token || !tokensIguais(token, webhookToken)) {
      throw new BadRequestException('Token do webhook inválido');
    }

    let body: {
      event?: string;
      checkout?: { id?: string };
      // Etapa 5B.5 — envelope dos eventos PAYMENT_* (refund incluso): a
      // Asaas embute o Payment completo no campo `payment` do webhook (ver
      // docs.asaas.com/docs/webhook-para-cobrancas). Só tipamos os campos
      // que realmente usamos aqui — não é um espelho completo do objeto.
      payment?: { id?: string; status?: string; value?: number };
    };
    try {
      body = JSON.parse(rawBody.toString('utf8')) as {
        event?: string;
        checkout?: { id?: string };
        payment?: { id?: string; status?: string; value?: number };
      };
    } catch {
      throw new BadRequestException('Payload do webhook inválido');
    }

    // Único evento que confirma pagamento concluído no fluxo de Asaas
    // Checkout usado por este projeto — os demais eventos de checkout
    // (CHECKOUT_CREATED, CHECKOUT_EXPIRED, CHECKOUT_CANCELED) são ignorados
    // com segurança: não marcam pedido como pago, não alteram estoque.
    if (body.event === 'CHECKOUT_PAID' && body.checkout?.id) {
      await this.confirmarPagamento({ asaasCheckoutId: body.checkout.id });
    } else if (
      body.event &&
      CheckoutService.EVENTOS_REEMBOLSO_ASAAS.has(body.event)
    ) {
      // Etapa 5B.5 — eventos de reembolso, tratados à parte de
      // CHECKOUT_PAID: identificam o Pedido por Payment (asaasPaymentId),
      // não por Checkout (asaasCheckoutId) — são recursos diferentes.
      await this.processarEventoReembolsoAsaas(
        body.event,
        body.payment?.id,
      );
    }

    // Mesmo padrão de sempre (CHECKOUT_PAID, e qualquer evento
    // desconhecido/ignorado): sempre confirma recebimento ao Asaas, mesmo
    // quando o evento não resultou em nenhuma mutação — nunca faz o Asaas
    // reentregar por engano algo que já foi tratado (ou que nunca vai
    // encontrar Pedido nenhum, ver item 4 da Etapa 5B.5).
    return { received: true };
  }

  // Etapa 5B.5 — trata os eventos de webhook de reembolso do Asaas
  // (PAYMENT_REFUND_IN_PROGRESS, PAYMENT_REFUNDED, PAYMENT_PARTIALLY_REFUNDED,
  // PAYMENT_REFUND_DENIED). Localiza o Pedido por Pedido.asaasPaymentId —
  // NUNCA por asaasCheckoutId (Checkout e Payment são recursos diferentes
  // na Asaas, ver AsaasService). Não chama a API do Asaas para confirmar
  // nada: o próprio webhook (já autenticado por handleWebhookAsaas via
  // ASAAS_WEBHOOK_TOKEN, comparação em tempo constante) é a confirmação —
  // payment.id em si nunca prova autenticidade, só serve para localizar o
  // Pedido depois que o token já validou a origem da requisição.
  private async processarEventoReembolsoAsaas(
    evento: string,
    paymentId: string | undefined,
  ): Promise<void> {
    if (!paymentId) {
      // Item H da etapa: payload incompleto — nunca tenta atualizar Pedido
      // "na tentativa" (ex.: por asaasCheckoutId) só porque um evento de
      // refund chegou sem payment.id.
      this.logger.warn(
        `Webhook Asaas ${evento} recebido sem payment.id — ignorado (nenhum Pedido pode ser identificado).`,
      );
      return;
    }

    const pedido = await this.prisma.pedido.findUnique({
      where: { asaasPaymentId: paymentId },
    });

    if (!pedido) {
      // Item 4 da etapa: webhook legítimo (token já validado), mas nenhum
      // Pedido tem este paymentId salvo ainda — nunca cria Pedido, nunca
      // altera nada, só registra para investigação.
      this.logger.warn(
        `Webhook Asaas ${evento} para paymentId ${paymentId} sem Pedido correspondente (Pedido.asaasPaymentId) — ignorado.`,
      );
      return;
    }

    if (evento !== 'PAYMENT_REFUNDED') {
      // PAYMENT_REFUND_IN_PROGRESS (item 5): continua REEMBOLSO_SOLICITADO.
      // PAYMENT_PARTIALLY_REFUNDED (item 9): MVP só suporta reembolso
      // total — nunca tratado como concluído, e não criamos um status novo
      // (ex.: REEMBOLSO_PARCIAL) só para representá-lo.
      // PAYMENT_REFUND_DENIED (item 10): preserva REEMBOLSO_SOLICITADO para
      // reconciliação manual — nunca volta sozinho para PAGO só com base
      // neste evento (o payload não traz garantia inequívoca de que nenhum
      // refund foi criado). Nenhum dos três altera status ou estoque; só
      // fica registrado para observabilidade/reconciliação futura.
      this.logger.warn(
        `Webhook Asaas ${evento} recebido para o pedido ${pedido.id} (status atual ${pedido.status}) — nenhuma transição de status aplicada nesta etapa.`,
      );
      return;
    }

    // PAYMENT_REFUNDED — confirmação definitiva de reembolso completo (item
    // 6): a transição válida é REEMBOLSO_SOLICITADO -> REEMBOLSADO, sem
    // depender de nenhuma chamada adicional ao Asaas. Idempotência real via
    // updateMany condicional (mesmo padrão de confirmarPagamento): só
    // transiciona se o status ainda for REEMBOLSO_SOLICITADO no exato
    // instante da escrita — reentrega do mesmo evento (item 7) encontra o
    // pedido já REEMBOLSADO, `count` vem 0, e o método simplesmente
    // termina sem erro nem efeito colateral.
    const resultado = await this.prisma.pedido.updateMany({
      where: { id: pedido.id, status: StatusPedido.REEMBOLSO_SOLICITADO },
      data: { status: StatusPedido.REEMBOLSADO },
    });

    // Etapa 5B.6 (item 4) — REEMBOLSADO não significa "estoque já
    // restaurado": só ItemPedido.estoqueRestaurado prova isso. Por isso o
    // pedido já estar REEMBOLSADO (reentrega do mesmo evento, ou uma
    // tentativa anterior que transicionou o status mas falhou na
    // restauração) NUNCA é motivo para retornar cedo — precisamos
    // distinguir esse caso (idempotência normal) do caso "fora de ordem"
    // (item 8/16: pedido ainda PAGO/PENDENTE/CANCELADO, nunca chegou a
    // REEMBOLSO_SOLICITADO), que continua protegido exatamente como na
    // Etapa 5B.5 — sem transição forçada, sem restauração de estoque.
    const jaEstavaReembolsado = pedido.status === StatusPedido.REEMBOLSADO;

    if (resultado.count === 0 && !jaEstavaReembolsado) {
      this.logger.warn(
        `Webhook Asaas PAYMENT_REFUNDED para o pedido ${pedido.id}, mas o status atual é ${pedido.status} (esperado REEMBOLSO_SOLICITADO) — nenhuma transição aplicada; requer investigação manual.`,
      );
      return;
    }

    // `resultado.count === 1` (transição feita agora) OU o pedido já estava
    // REEMBOLSADO (reentrega/retry) — em ambos os casos prosseguimos para a
    // restauração idempotente de estoque; é o próprio helper quem decide,
    // item a item, o que ainda precisa ser restaurado.
    await this.restaurarEstoqueAposReembolso(pedido.id);
  }

  // Etapa 5B.6 — rotina única e reutilizável de restauração de estoque após
  // reembolso confirmado (PAYMENT_REFUNDED). Pode ser chamada com segurança
  // mais de uma vez para o mesmo pedido (webhook duplicado, retry manual
  // após falha, reconciliação futura) — cada ItemPedido decide por si só,
  // via `estoqueRestaurado`, se ainda precisa ser processado.
  //
  // Fonte de verdade dupla, nunca confundida (item 2 da etapa):
  // `estoqueBaixado` prova que o item ALGUM DIA decrementou estoque;
  // `estoqueRestaurado` prova que essa baixa JÁ FOI devolvida. Só itens com
  // estoqueBaixado === true entram na tentativa de restauração — `false`
  // nunca altera Produto.quantidade (item nunca teve estoque decrementado),
  // e `null` (histórico anterior à migration 5A.2, indeterminado) NUNCA é
  // tratado como true nem como false: fica de fora, registrado via warning,
  // aguardando reconciliação manual — igual ao mesmo raciocínio já usado em
  // PedidosService.cancelar() para o mesmo campo.
  private async restaurarEstoqueAposReembolso(pedidoId: number): Promise<void> {
    const itens = await this.prisma.itemPedido.findMany({
      where: { pedidoId },
    });

    const itensElegiveis = itens.filter((item) => {
      if (item.estoqueBaixado === null) {
        this.logger.warn(
          `Restauração de estoque bloqueada para reconciliação manual: ` +
            `itemPedido ${item.id} do pedido ${pedidoId} (produto ${item.produtoId}) ` +
            `tem estoqueBaixado indeterminado (histórico anterior à migration 5A.2).`,
        );
        return false;
      }
      return item.estoqueBaixado === true;
    });

    if (itensElegiveis.length === 0) {
      return;
    }

    // Etapa 5B.6 (itens 6–9) — uma única transação para todo o pedido,
    // mesmo padrão já usado em confirmarPagamento: se qualquer incremento
    // falhar, o ROLLBACK desfaz TODAS as marcações/incrementos já feitos
    // neste mesmo processamento (nenhum item fica marcado restaurado sem o
    // incremento correspondente ter sido confirmado) — uma nova tentativa
    // futura (reentrega do webhook, reconciliação manual) encontra
    // novamente `estoqueRestaurado: false` e processa do zero com segurança.
    //
    // Dentro da transação, cada item usa um claim atômico condicional
    // (idêntico em espírito ao updateMany já usado em cancelar()/
    // confirmarPagamento()/solicitarReembolso() neste mesmo arquivo/
    // serviço): a UPDATE em si adquire o lock de linha do ItemPedido no
    // Postgres, então duas transações concorrentes (dois webhooks
    // PAYMENT_REFUNDED simultâneos para o mesmo pedido) nunca conseguem as
    // duas `count === 1` para o mesmo item — a segunda só prossegue depois
    // que a primeira commita, e nesse ponto a condição `estoqueRestaurado:
    // false` do WHERE já não bate mais (a primeira já commitou `true`),
    // então a segunda recebe `count === 0` e NUNCA chama
    // `produtosService.adicionarEstoque` para aquele item — impossível
    // dobrar o incremento por corrida.
    await this.prisma.$transaction(async (tx) => {
      for (const item of itensElegiveis) {
        const claim = await tx.itemPedido.updateMany({
          where: { id: item.id, estoqueBaixado: true, estoqueRestaurado: false },
          data: { estoqueRestaurado: true },
        });

        if (claim.count === 0) {
          // Já restaurado por outro processamento (idempotência) — nunca
          // incrementa estoque de novo para este item.
          continue;
        }

        // Mesmo produto pode aparecer em mais de um item do pedido (item 10
        // da etapa) — cada item soma sua própria quantidade independentemente,
        // dentro da mesma transação: dois itens do Produto 10 (quantidades 2
        // e 3) resultam em +2 e +3 nesta mesma `tx`, nunca em uma agregação
        // prematura que perderia a rastreabilidade por item.
        await this.produtosService.adicionarEstoque(
          item.produtoId,
          item.quantidade,
          tx,
        );
      }
    });
  }

  // Pagamento confirmado pelo gateway -> Pedido PENDENTE -> Pedido PAGO ->
  // baixa de estoque. NUNCA "cliente acessou /checkout/sucesso -> PAGO" —
  // essa página é só um retorno visual (Tasks 12/14), sem nenhuma ligação
  // com este método.
  private async confirmarPagamento(
    where: { stripeSessionId: string } | { asaasCheckoutId: string },
  ): Promise<void> {
    const pedido = await this.prisma.pedido.findUnique({
      where,
      include: { itens: true },
    });

    // Evento legítimo (assinatura/token já validado), mas sem pedido
    // correspondente no nosso banco — não cria pedido, não altera estoque,
    // só responde de forma controlada (ver handleWebhook: sempre
    // `{ received: true }`, nunca um erro que faria o gateway reenviar algo
    // que nunca vai encontrar pedido nenhum).
    if (!pedido) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      // Idempotência real (não só "checar antes"): esta UPDATE só afeta a
      // linha se o status ainda for PENDENTE no exato instante da escrita —
      // o próprio Postgres serializa duas transações concorrentes tentando
      // fazer isso ao mesmo tempo para o mesmo pedido (webhook duplicado,
      // reentrega do gateway, corrida entre duas requisições). Se `count`
      // vier 0, outra entrega deste mesmo evento (ou um estado que não é
      // mais PENDENTE por qualquer outro motivo) já tratou isso — sai sem
      // tocar em estoque, sem lançar erro, sem processar de novo.
      const resultado = await tx.pedido.updateMany({
        where: { id: pedido.id, status: StatusPedido.PENDENTE },
        data: { status: StatusPedido.PAGO },
      });

      if (resultado.count === 0) {
        return;
      }

      // Quantidade vem exclusivamente dos itens do PEDIDO já persistidos no
      // backend (nunca de preço/quantidade reenviados pelo cliente) — e
      // removerEstoque (ProdutosService) é o mesmo método atômico já
      // auditado contra overselling, agora rodando dentro desta transação
      // via `tx`: se qualquer item não tiver estoque suficiente, a exceção
      // desfaz a transação inteira, incluindo a mudança de status acima —
      // o pedido volta a ficar exatamente como estava (PENDENTE), nenhum
      // produto fica com baixa parcial.
      for (const item of pedido.itens) {
        await this.produtosService.removerEstoque(
          item.produtoId,
          item.quantidade,
          tx,
        );
        // Etapa 5A.2 (achado da auditoria 5A.1) — só marca true DEPOIS do
        // removerEstoque acima ter dado certo, dentro da mesma `tx`: se
        // qualquer item não tiver estoque suficiente, a exceção desfaz tudo,
        // inclusive marcações já feitas neste loop — nenhum item fica
        // marcado true sem o decremento correspondente ter realmente
        // acontecido.
        await tx.itemPedido.update({
          where: { id: item.id },
          data: { estoqueBaixado: true },
        });
      }
    });
  }
}
