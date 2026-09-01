import {
  BadRequestException,
  Injectable,
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
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import {
  CheckoutSessionResponse,
  CheckoutSessionStatus,
} from './entities/checkout-session.entity';

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
  private readonly gateway: CheckoutGateway;
  private readonly frontendUrl: string;
  // Legado (Task 21) — só instanciado no modo de rollback
  // (CHECKOUT_GATEWAY="stripe"). Preservado exatamente como na integração
  // original (Task 15): é o caminho que garante que voltar para o Stripe
  // continua funcionando se o Asaas precisar ser revertido.
  private readonly stripe?: Stripe;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly produtosService: ProdutosService,
    private readonly enderecosService: EnderecosService,
    private readonly asaasService: AsaasService,
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
    if (!dto.itens.length) {
      throw new BadRequestException('O carrinho está vazio');
    }

    // Task 15 (achado da auditoria): valida que o endereço existe e pertence
    // a este usuário (404 caso contrário) — mas o schema atual de Pedido não
    // tem NENHUM campo de endereço (nem enderecoId, nem snapshot), então não
    // há onde persistir qual endereço foi escolhido. Decisão registrada:
    // manter só a validação de posse aqui, sem migração Prisma nesta task —
    // ver relatório da Task 15 para a limitação completa.
    await this.enderecosService.findOneForUsuario(dto.enderecoId, usuarioId);

    let total = 0;
    const itensPedido: {
      produtoId: number;
      quantidade: number;
      precoUnitario: number;
      subtotal: number;
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

      const subtotal = produto.preco * item.quantidade;
      total += subtotal;
      itensPedido.push({
        produtoId: produto.id,
        quantidade: item.quantidade,
        precoUnitario: produto.preco,
        subtotal,
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
        itens: {
          create: itensPedido,
        },
      },
    });

    return this.gateway === 'stripe'
      ? this.criarSessaoStripe(dto, pedido, itensSelecionados)
      : this.criarSessaoAsaas(pedido, itensSelecionados);
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

    let body: { event?: string; checkout?: { id?: string } };
    try {
      body = JSON.parse(rawBody.toString('utf8')) as {
        event?: string;
        checkout?: { id?: string };
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
    }

    return { received: true };
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
      }
    });
  }
}
