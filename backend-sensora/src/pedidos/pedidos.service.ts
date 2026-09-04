import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Pedido as PedidoPrisma } from '../../generated/prisma/client';
import { Prisma } from '../../generated/prisma/client';
import { AsaasErroHttpError, AsaasService } from '../asaas/asaas.service';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { ItemPedido } from '../itens-pedido/entities/item-pedido.entity';
import { ItensPedidoService } from '../itens-pedido/itens-pedido.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../produtos/produtos.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { PedidoComItens } from './entities/pedido-com-itens.entity';
import { PedidoComItensDetalhado } from './entities/pedido-com-itens-detalhado.entity';
import { Pedido } from './entities/pedido.entity';
import { StatusEnvio } from './enums/status-envio.enum';
import { StatusPedido } from './enums/status-pedido.enum';

@Injectable()
export class PedidosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ItensPedidoService))
    private readonly itensPedidoService: ItensPedidoService,
    private readonly produtosService: ProdutosService,
    private readonly asaasService: AsaasService,
  ) {}

  // Etapa 10 / Task 5 (achado A6): ADMIN continua vendo/editando qualquer
  // pedido. VENDEDOR só enxerga pedidos cujo `usuarioId` é o dele mesmo —
  // usa a coluna que já existia no schema (antes nunca lida/escrita por
  // nenhum código) em vez de criar uma relação nova.
  private podeAcessar(
    pedido: { usuarioId: number | null },
    user: UsuarioAutenticado,
  ): boolean {
    return user.perfil === PerfilUsuario.ADMIN || pedido.usuarioId === user.id;
  }

  // Achado da auditoria (integridade financeira): pedido PAGO ou CANCELADO é
  // tratado como imutável — nenhuma mutação (do próprio pedido ou dos itens
  // vinculados, ver ItensPedidoService) pode alterá-lo depois de finalizado.
  // Público porque ItensPedidoService também precisa desta checagem antes de
  // criar/alterar/remover um item. Só afeta mutação — leitura (findOne,
  // findAll, buscarPedidoComItens) continua liberada normalmente.
  garantirMutavel(pedido: { status: StatusPedido }): void {
    if (pedido.status !== StatusPedido.PENDENTE) {
      throw new ConflictException(
        `Pedido com status ${pedido.status} não pode ser alterado.`,
      );
    }
  }

  // `ordenarPorDataDesc` é opt-in (default false) para não alterar o
  // comportamento de GET /pedidos/meus (Minha Conta), que reaproveita este
  // mesmo método sem passar a opção — só a listagem do Admin (GET /pedidos)
  // pede a ordenação. `data` é o campo já existente que funciona como data
  // de criação do pedido (setado uma única vez em CheckoutService.
  // createSession/PedidosService.create, nunca tocado por update() a menos
  // que explicitamente enviado).
  async findAll(
    user: UsuarioAutenticado,
    opts?: { ordenarPorDataDesc?: boolean },
  ): Promise<Pedido[]> {
    const where =
      user.perfil === PerfilUsuario.ADMIN ? {} : { usuarioId: user.id };
    const pedidos = await this.prisma.pedido.findMany({
      where,
      ...(opts?.ordenarPorDataDesc && { orderBy: { data: 'desc' } }),
    });
    return pedidos.map((pedido) => this.paraPedido(pedido));
  }

  async findOne(id: number, user: UsuarioAutenticado): Promise<Pedido> {
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    // Mesma mensagem/status para "não existe" e "existe mas não é seu" —
    // não confirma a existência de um pedido fora do escopo do VENDEDOR.
    if (!pedido || !this.podeAcessar(pedido, user)) {
      throw new NotFoundException(`Pedido com id ${id} não encontrado`);
    }
    return this.paraPedido(pedido);
  }

  // Etapa 8.1 (complemento — eliminação da venda manual) — create() foi
  // removido de propósito: não existe mais criação administrativa de
  // Pedido, nem como PENDENTE. A única origem de um Pedido novo é
  // CheckoutService.createSession, que grava direto via Prisma (nunca
  // chama este service) — ver checkout.service.ts. Este service agora só
  // gerencia pedidos já existentes.

  async update(
    id: number,
    updatePedidoDto: UpdatePedidoDto,
    user: UsuarioAutenticado,
  ): Promise<Pedido> {
    const pedidoAtual = await this.findOne(id, user);
    this.garantirMutavel(pedidoAtual);
    const { numero, data } = updatePedidoDto;

    // Achado da auditoria (HIGH-01): whitelist explícita dos campos
    // mutáveis, nunca um spread genérico do DTO — mesmo que `status` volte
    // a existir em UpdatePedidoDto por algum motivo no futuro, ele NUNCA
    // chegaria ao Prisma por aqui sem uma linha nova e visível abaixo. A
    // única origem legítima de `status: PAGO` continua sendo
    // CheckoutService.confirmarPagamento() (webhook CHECKOUT_PAID).
    //
    // Etapa 8.8 (achado da auditoria — integridade financeira de
    // Pedido.total): `total` deixou de ser lido/repassado aqui, mesmo que o
    // cliente o envie — permanece em UpdatePedidoDto só por compatibilidade
    // de payload com chamadas existentes (nunca usado a partir de agora,
    // ver PUT /admin/pedidos/[id] no frontend, que reenvia esse campo).
    // O valor persistido é sempre derivado dos ItemPedido reais + frete
    // (recalcularTotal), mesmo raciocínio já aplicado a
    // ItemPedido.precoUnitario na Etapa 8.1: cliente nunca é autoridade
    // sobre um valor financeiro que o backend consegue determinar sozinho.
    await this.prisma.pedido.update({
      where: { id },
      data: {
        ...(numero !== undefined && { numero }),
        ...(data !== undefined && { data: new Date(data) }),
      },
    });
    return this.recalcularTotal(id);
  }

  // Etapa 8.8 (integridade financeira de Pedido.total) — única rotina que
  // escreve Pedido.total: sempre derivado da soma de ItemPedido.subtotal
  // (já um preço histórico confiável, nunca recalculado a partir do preço
  // ATUAL do Produto — ver ItensPedidoService) + freteValor (nunca
  // recotado aqui, é o mesmo valor validado contra o Melhor Envio na
  // criação do pedido, ver CheckoutService.createSession) — nunca aceito
  // como número solto vindo de fora. Mesmo padrão de client opcional já
  // usado em ProdutosService.removerEstoque/adicionarEstoque: default
  // `this.prisma`, mas aceita um `tx` de uma transação já aberta por quem
  // chama (ver ItensPedidoService.update()/remove(), que precisam que a
  // escrita do item e o recálculo do total aconteçam atomicamente).
  // Reaplica garantirMutavel() aqui também (não só nos callers) como defesa
  // em profundidade: nenhum uso futuro deste método pode, por engano,
  // destravar o total de um pedido PAGO/REEMBOLSO_SOLICITADO/REEMBOLSADO.
  async recalcularTotal(
    pedidoId: number,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Pedido> {
    const pedidoAtual = await client.pedido.findUniqueOrThrow({
      where: { id: pedidoId },
    });
    this.garantirMutavel({ status: pedidoAtual.status as StatusPedido });

    const itens = await client.itemPedido.findMany({
      where: { pedidoId },
    });
    const subtotalItens = itens.reduce(
      (soma, item) => soma + Number(item.subtotal),
      0,
    );
    const frete =
      pedidoAtual.freteValor !== null ? Number(pedidoAtual.freteValor) : 0;

    const atualizado = await client.pedido.update({
      where: { id: pedidoId },
      data: { total: subtotalItens + frete },
    });
    return this.paraPedido(atualizado);
  }

  // Etapa 8.2 (HIGH-02 — hard-delete de pedido financeiramente relevante) —
  // só PENDENTE pode ser excluído; PAGO/CANCELADO/REEMBOLSO_SOLICITADO/
  // REEMBOLSADO são sempre rejeitados com 409, para nunca apagar histórico
  // financeiro. Mesmo padrão de claim atômico já usado em cancelar()/
  // solicitarReembolso()/marcarComoEnviado(): `deleteMany` condicionado a
  // `status: PENDENTE` no WHERE é o que garante atomicidade contra a
  // corrida "status muda entre a leitura e a exclusão" (ex.: webhook
  // CHECKOUT_PAID confirmando o pagamento entre o findOne() abaixo e a
  // exclusão) — o Postgres só apaga a linha se o status ainda for PENDENTE
  // no exato instante da escrita; `count === 0` nunca é assumido como "já
  // não existe" (isso já foi descartado pelo findOne() acima), sempre como
  // "não é mais PENDENTE".
  //
  // ItemPedido é excluído em cascata pelo próprio Postgres (`onDelete:
  // Cascade` em ItemPedido.pedido, ver schema.prisma) — nenhuma lógica de
  // estoque nova é necessária aqui: um pedido ainda PENDENTE nunca tem item
  // com estoqueBaixado:true (só CheckoutService.confirmarPagamento()
  // decrementa estoque, e ele SEMPRE transiciona o status para PAGO na
  // mesma transação — ver checkout.service.ts), então excluir os itens de
  // um pedido PENDENTE nunca deixa estoque "preso" nem exige restauração.
  async remove(id: number, user: UsuarioAutenticado): Promise<void> {
    const pedidoAtual = await this.findOne(id, user);

    const ownerFilter =
      user.perfil === PerfilUsuario.ADMIN ? {} : { usuarioId: user.id };

    const resultado = await this.prisma.pedido.deleteMany({
      where: { id, ...ownerFilter, status: StatusPedido.PENDENTE },
    });

    if (resultado.count === 0) {
      // Reconsulta o status real em vez de confiar no que foi lido um
      // instante atrás (mesmo raciocínio de cancelar()): numa corrida
      // genuína, `pedidoAtual.status` já estaria desatualizado.
      const atual = await this.prisma.pedido.findUnique({
        where: { id },
        select: { status: true },
      });
      throw new ConflictException(
        `Pedido com status ${atual?.status ?? pedidoAtual.status} não pode ser excluído.`,
      );
    }
  }

  // Etapa 5A (Cancelamento de Pedido) — única transição permitida por este
  // método é PENDENTE -> CANCELADO; PAGO/CANCELADO são sempre rejeitados
  // (nenhum reembolso/estorno Asaas acontece aqui, de propósito — fora do
  // escopo desta etapa). Mesmo padrão de CheckoutService.confirmarPagamento:
  // updateMany condicionado a `status: PENDENTE` no WHERE é o que garante
  // atomicidade contra duplo cancelamento (duas requisições simultâneas —
  // o Postgres serializa, só uma vê count=1, a outra vê count=0 e recebe um
  // erro claro em vez de restaurar estoque duas vezes). Ownership é
  // resolvido duas vezes de propósito: findOne() já garante 404 para pedido
  // inexistente/de outro usuário (mesmo padrão de sempre), e `ownerFilter`
  // repete a mesma condição diretamente no updateMany (defesa em
  // profundidade dentro da transação, sem custo extra).
  async cancelar(id: number, user: UsuarioAutenticado): Promise<Pedido> {
    const pedidoAtual = await this.findOne(id, user);

    // Etapa 5A.2 (achado da auditoria 5A.1) — busca direta via Prisma (não
    // itensPedidoService.findByPedidoId, que devolve o DTO público sem
    // estoqueBaixado — este campo é uso interno, nunca exposto na API).
    // A decisão de restaurar estoque é por ITEM, nunca pela origem do
    // pedido inteiro (um mesmo pedido pode ter itens mistos).
    const itens = await this.prisma.itemPedido.findMany({
      where: { pedidoId: id },
    });

    // Achado da auditoria 5A.1: um item com estoqueBaixado null é um
    // registro histórico anterior à migration que introduziu este campo —
    // não há como saber com segurança se o estoque dele foi ou não
    // decrementado. Bloqueia ANTES de qualquer mutação (nem o status muda),
    // em vez de arriscar restaurar (ou deixar de restaurar) incorretamente.
    const itemIndeterminado = itens.find(
      (item) => item.estoqueBaixado === null,
    );
    if (itemIndeterminado) {
      throw new ConflictException(
        `Pedido possui item(ns) com histórico de estoque indeterminado ` +
          `(item ${itemIndeterminado.id}) — cancelamento bloqueado até revisão manual.`,
      );
    }

    const ownerFilter =
      user.perfil === PerfilUsuario.ADMIN ? {} : { usuarioId: user.id };

    const pedidoCancelado = await this.prisma.$transaction(async (tx) => {
      const resultado = await tx.pedido.updateMany({
        where: { id, ...ownerFilter, status: StatusPedido.PENDENTE },
        data: { status: StatusPedido.CANCELADO },
      });

      if (resultado.count === 0) {
        // Reconsulta o status real dentro da transação: numa corrida
        // genuína (outra requisição cancelou entre o findOne() acima e
        // aqui), `pedidoAtual.status` já estaria desatualizado (mostraria
        // PENDENTE) — a mensagem de erro precisa refletir o estado atual,
        // não o que foi lido um instante antes.
        const atual = await tx.pedido.findUnique({
          where: { id },
          select: { status: true },
        });
        throw new ConflictException(
          `Pedido com status ${atual?.status ?? pedidoAtual.status} não pode ser cancelado.`,
        );
      }

      // Restaura exatamente a quantidade reservada por item — nunca
      // recalculada, nunca reenviada pelo cliente — e só para os itens que
      // realmente tiveram estoque decrementado (estoqueBaixado === true).
      // Item do checkout ainda não pago (estoqueBaixado === false) nunca
      // teve estoque removido, então não há nada a devolver — restaurá-lo
      // criaria estoque fantasma (achado da auditoria 5A.1). adicionarEstoque
      // nunca deixa o estoque negativo (só incrementa) e participa desta
      // mesma transação via `tx`: se qualquer passo falhar, o status volta a
      // PENDENTE junto com o resto (rollback completo).
      for (const item of itens) {
        if (item.estoqueBaixado) {
          await this.produtosService.adicionarEstoque(
            item.produtoId,
            item.quantidade,
            tx,
          );
        }
      }

      return tx.pedido.findUniqueOrThrow({ where: { id } });
    });

    return this.paraPedido(pedidoCancelado);
  }

  // Etapa 5B.4 — solicitação de reembolso pelo cliente (PAGO ->
  // REEMBOLSO_SOLICITADO -> [REEMBOLSADO | permanece REEMBOLSO_SOLICITADO]).
  // Não implementa aqui: webhook PAYMENT_REFUNDED (próxima etapa),
  // restauração de estoque (depende da confirmação definitiva do webhook,
  // não deste endpoint) nem reembolso parcial.
  async solicitarReembolso(id: number, user: UsuarioAutenticado): Promise<Pedido> {
    const pedidoAtual = await this.findOne(id, user);

    // Idempotência de negócio: reenvio do cliente (double-click, retry de
    // rede) sobre um pedido que já está em processamento ou já foi
    // reembolsado nunca dispara um segundo refund — só devolve o estado
    // atual. Diferente do "perdeu o claim" abaixo: aqui nem tentamos a
    // transição, porque ela já não é PAGO desde antes desta chamada.
    if (
      pedidoAtual.status === StatusPedido.REEMBOLSO_SOLICITADO ||
      pedidoAtual.status === StatusPedido.REEMBOLSADO
    ) {
      return pedidoAtual;
    }

    if (pedidoAtual.status !== StatusPedido.PAGO) {
      // PENDENTE (cancelamento é responsabilidade de `cancelar()`) ou
      // qualquer outro estado não previsto.
      throw new ConflictException(
        `Pedido com status ${pedidoAtual.status} não pode ser reembolsado.`,
      );
    }

    // Claim atômico via updateMany condicionado (mesmo padrão de
    // `cancelar()`): o Postgres serializa duas requisições simultâneas para
    // o mesmo pedido — só uma vê `count === 1` e pode prosseguir para o
    // Asaas, a outra vê `count === 0` e nunca chama a API externa. De
    // propósito, SEM `$transaction` envolvendo a chamada ao Asaas: o claim é
    // uma única operação atômica por si só, e o HTTP para o gateway externo
    // roda inteiramente depois, fora de qualquer transação Prisma.
    const ownerFilter =
      user.perfil === PerfilUsuario.ADMIN ? {} : { usuarioId: user.id };

    const claim = await this.prisma.pedido.updateMany({
      where: { id, ...ownerFilter, status: StatusPedido.PAGO },
      data: { status: StatusPedido.REEMBOLSO_SOLICITADO },
    });

    if (claim.count === 0) {
      // Perdeu a corrida (ou o status mudou por outro motivo entre o
      // findOne() acima e aqui) — reconsulta o estado real em vez de confiar
      // no que foi lido um instante atrás.
      const atual = await this.prisma.pedido.findUniqueOrThrow({
        where: { id },
      });
      if (
        atual.status === StatusPedido.REEMBOLSO_SOLICITADO ||
        atual.status === StatusPedido.REEMBOLSADO
      ) {
        return this.paraPedido(atual);
      }
      throw new ConflictException(
        `Pedido com status ${atual.status} não pode ser reembolsado.`,
      );
    }

    let pedidoAtualizado = await this.prisma.pedido.findUniqueOrThrow({
      where: { id },
    });

    const paymentId = await this.resolverPaymentId(pedidoAtualizado);

    if (!paymentId) {
      // Sem asaasPaymentId E sem asaasCheckoutId (ou checkout que não
      // resolveu a nenhum Payment na Asaas) — não há como chamar o Asaas
      // com segurança, e nunca inventamos um Payment ID. Nenhuma chamada
      // HTTP foi feita ainda neste caso, então reverter o claim é seguro:
      // não existe risco de duplo refund, só devolve o pedido a um estado
      // consistente (PAGO) para uma tentativa futura, quando a informação
      // existir.
      await this.prisma.pedido.updateMany({
        where: { id, status: StatusPedido.REEMBOLSO_SOLICITADO },
        data: { status: StatusPedido.PAGO },
      });
      throw new UnprocessableEntityException(
        'Não há informação de pagamento no Asaas suficiente para solicitar o reembolso deste pedido.',
      );
    }

    try {
      // Item 9 da etapa: nunca solicita um novo refund sem antes checar se
      // já existe um (reduz risco de duplicidade em reenvio/corrida que o
      // claim sozinho não cobriria, ex.: claim ganho numa tentativa anterior
      // que já chegou a chamar o Asaas, mas cuja resposta se perdeu antes de
      // atualizar o pedido para REEMBOLSADO).
      const refunds = await this.asaasService.consultarEstornos(paymentId);

      const refundConcluido = refunds.find((refund) => refund.status === 'DONE');
      if (refundConcluido) {
        pedidoAtualizado = await this.prisma.pedido.update({
          where: { id },
          data: { status: StatusPedido.REEMBOLSADO },
        });
        return this.paraPedido(pedidoAtualizado);
      }

      // Qualquer refund que não seja DONE nem CANCELLED (ex.: PENDING,
      // AWAITING_CRITICAL_ACTION_AUTHORIZATION) já está em processamento no
      // Asaas — CANCELLED é ignorado de propósito (refund cancelado não
      // bloqueia uma nova tentativa).
      const refundEmAndamento = refunds.find(
        (refund) => refund.status !== 'CANCELLED',
      );
      if (refundEmAndamento) {
        return this.paraPedido(pedidoAtualizado);
      }

      const refund = await this.asaasService.estornarPagamento(paymentId);

      // Achado da auditoria (Etapa 5B.3): HTTP 200 do POST /refund só
      // confirma que a Asaas ACEITOU a solicitação, nunca que o dinheiro já
      // voltou — só `status === 'DONE'` no corpo do refund representa
      // reembolso concluído. `PENDING`/outro mantém REEMBOLSO_SOLICITADO tal
      // como já está (nada a fazer aqui): a confirmação definitiva fica para
      // o webhook PAYMENT_REFUNDED de uma etapa futura.
      if (refund.status === 'DONE') {
        pedidoAtualizado = await this.prisma.pedido.update({
          where: { id },
          data: { status: StatusPedido.REEMBOLSADO },
        });
      }

      return this.paraPedido(pedidoAtualizado);
    } catch (erro) {
      // Item 12/13 da etapa: só reverte para PAGO quando há CERTEZA de que a
      // solicitação de refund não foi aceita/criada (AsaasErroHttpError — o
      // Asaas respondeu e recusou). Timeout/erro de rede (AsaasIndisponivelError)
      // e qualquer outro erro NUNCA reverte — não sabemos se o Asaas chegou
      // a processar a solicitação, então o pedido permanece
      // REEMBOLSO_SOLICITADO para reconciliação manual/futura (webhook).
      if (erro instanceof AsaasErroHttpError) {
        await this.prisma.pedido.updateMany({
          where: { id, status: StatusPedido.REEMBOLSO_SOLICITADO },
          data: { status: StatusPedido.PAGO },
        });
      }
      throw erro;
    }
  }

  // Etapa 6.6 (Status de Envio) — MVP, ação administrativa manual
  // (STAFF_ROLES, ver PedidosController). Eixo logístico (`statusEnvio`)
  // INDEPENDENTE do financeiro (`status`) — nunca reaproveita
  // garantirMutavel() nem qualquer lógica de cancelar()/solicitarReembolso(),
  // de propósito: marcar como enviado não é uma edição genérica de pedido
  // (não mexe em numero/data/total) nem uma transição financeira, é uma
  // operação própria com sua própria regra (só a partir de PAGO). Mesmo
  // padrão de claim atômico já usado em cancelar()/solicitarReembolso():
  // updateMany condicionado ao estado atual (`status: PAGO, statusEnvio:
  // NAO_ENVIADO`) garante que, em duas requisições concorrentes, só uma
  // escreve `enviadoEm` — a perdedora nunca sobrescreve o momento real do
  // envio (item 7 da etapa), só devolve o pedido já atualizado pela
  // primeira (idempotência, item 5).
  async marcarComoEnviado(id: number, user: UsuarioAutenticado): Promise<Pedido> {
    const pedidoAtual = await this.findOne(id, user);

    // Idempotência de negócio: reenvio (double-click, retry) sobre um
    // pedido já enviado nunca tenta a transição de novo — só devolve o
    // estado atual, sem tocar em enviadoEm. Mesmo raciocínio do early-return
    // de solicitarReembolso para REEMBOLSO_SOLICITADO/REEMBOLSADO.
    if (pedidoAtual.statusEnvio === StatusEnvio.ENVIADO) {
      return pedidoAtual;
    }

    if (pedidoAtual.status !== StatusPedido.PAGO) {
      throw new ConflictException(
        `Pedido com status ${pedidoAtual.status} não pode ser marcado como enviado.`,
      );
    }

    const ownerFilter =
      user.perfil === PerfilUsuario.ADMIN ? {} : { usuarioId: user.id };

    const claim = await this.prisma.pedido.updateMany({
      where: {
        id,
        ...ownerFilter,
        status: StatusPedido.PAGO,
        statusEnvio: StatusEnvio.NAO_ENVIADO,
      },
      data: { statusEnvio: StatusEnvio.ENVIADO, enviadoEm: new Date() },
    });

    if (claim.count === 0) {
      // Perdeu a corrida (ou o estado mudou por outro motivo entre o
      // findOne() acima e aqui) — reconsulta o estado real em vez de confiar
      // no que foi lido um instante atrás. Se outra requisição venceu a
      // corrida e já marcou como ENVIADO, devolve o resultado dela
      // (idempotente, sem sobrescrever enviadoEm); qualquer outro caso
      // (status deixou de ser PAGO nesse meio tempo) é erro de negócio real.
      const atual = await this.findOne(id, user);
      if (atual.statusEnvio === StatusEnvio.ENVIADO) {
        return atual;
      }
      throw new ConflictException(
        `Pedido com status ${atual.status} não pode ser marcado como enviado.`,
      );
    }

    return this.findOne(id, user);
  }

  // Resolve o Payment ID a usar para o reembolso: usa o já persistido em
  // Pedido.asaasPaymentId quando existir (nunca resolve de novo pelo
  // Checkout nesse caso), senão tenta resolver via asaasCheckoutId e
  // persiste o resultado para as próximas chamadas. `null` = informação
  // insuficiente (nem paymentId nem checkoutId, ou checkout que não resolveu
  // a nenhum Payment) — nunca inventa um Payment ID.
  private async resolverPaymentId(pedido: {
    id: number;
    asaasPaymentId: string | null;
    asaasCheckoutId: string | null;
  }): Promise<string | null> {
    if (pedido.asaasPaymentId) {
      return pedido.asaasPaymentId;
    }

    if (!pedido.asaasCheckoutId) {
      return null;
    }

    const resultado = await this.asaasService.resolverPaymentIdPorCheckout(
      pedido.asaasCheckoutId,
    );

    if (!resultado.encontrado) {
      return null;
    }

    await this.prisma.pedido.update({
      where: { id: pedido.id },
      data: { asaasPaymentId: resultado.payment.id },
    });

    return resultado.payment.id;
  }

  async buscarItensDoPedido(
    pedidoId: number,
    user: UsuarioAutenticado,
  ): Promise<ItemPedido[]> {
    await this.findOne(pedidoId, user);
    return this.itensPedidoService.findByPedidoId(pedidoId);
  }

  async calcularTotalPedido(
    pedidoId: number,
    user: UsuarioAutenticado,
  ): Promise<number> {
    return this.somarSubtotais(await this.buscarItensDoPedido(pedidoId, user));
  }

  async buscarPedidoComItens(
    pedidoId: number,
    user: UsuarioAutenticado,
  ): Promise<PedidoComItens> {
    const pedido = await this.findOne(pedidoId, user);
    const itens = await this.buscarItensDoPedido(pedidoId, user);
    return { pedido, itens, total: this.somarSubtotais(itens) };
  }

  // Etapa 2 (Minha Conta / Meus Pedidos) — mesma checagem de ownership de
  // buscarPedidoComItens (reaproveitado sem alteração, inclusive o 404
  // genérico para pedido inexistente/de outro usuário), só acrescenta
  // nome/imagem do produto a cada item para a tela do cliente. Busca direta
  // via `this.prisma.produto` (não ProdutosService.findOne) de propósito:
  // um produto excluído depois do pedido não pode derrubar a página inteira
  // com 404 — cai no fallback "Produto não disponível" abaixo.
  async buscarPedidoComItensDetalhado(
    pedidoId: number,
    user: UsuarioAutenticado,
  ): Promise<PedidoComItensDetalhado> {
    const { pedido, itens, total } = await this.buscarPedidoComItens(
      pedidoId,
      user,
    );

    const produtoIds = [...new Set(itens.map((item) => item.produtoId))];
    const produtos = await this.prisma.produto.findMany({
      where: { id: { in: produtoIds } },
      select: { id: true, nome: true, imagemUrl: true },
    });
    const produtoPorId = new Map(produtos.map((produto) => [produto.id, produto]));

    const itensDetalhados = itens.map((item) => {
      const produto = produtoPorId.get(item.produtoId);
      return {
        ...item,
        produtoNome: produto?.nome ?? 'Produto não disponível',
        produtoImagemUrl: produto?.imagemUrl ?? null,
      };
    });

    return { pedido, itens: itensDetalhados, total };
  }

  private somarSubtotais(itens: ItemPedido[]): number {
    return itens.reduce((total, item) => total + item.subtotal, 0);
  }

  private paraPedido(pedido: PedidoPrisma): Pedido {
    return {
      id: pedido.id,
      numero: pedido.numero,
      data: pedido.data,
      status: pedido.status as StatusPedido,
      total: Number(pedido.total),
      enderecoCep: pedido.enderecoCep ?? undefined,
      enderecoRua: pedido.enderecoRua ?? undefined,
      enderecoNumero: pedido.enderecoNumero ?? undefined,
      enderecoComplemento: pedido.enderecoComplemento ?? undefined,
      enderecoBairro: pedido.enderecoBairro ?? undefined,
      enderecoCidade: pedido.enderecoCidade ?? undefined,
      enderecoEstado: pedido.enderecoEstado ?? undefined,
      freteValor:
        pedido.freteValor !== null ? Number(pedido.freteValor) : undefined,
      freteTransportadora: pedido.freteTransportadora ?? undefined,
      freteServico: pedido.freteServico ?? undefined,
      fretePrazoDias: pedido.fretePrazoDias ?? undefined,
      statusEnvio: pedido.statusEnvio as StatusEnvio,
      enviadoEm: pedido.enviadoEm ?? undefined,
    };
  }
}
