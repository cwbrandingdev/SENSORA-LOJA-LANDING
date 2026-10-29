import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { UsuariosService } from '../usuarios/usuarios.service';
import { SalvarCupomDto } from './dto/salvar-cupom.dto';
import { PublicoCupom } from './enums/publico-cupom.enum';
import { TipoDescontoCupom } from './enums/tipo-desconto-cupom.enum';
import {
  CupomAplicado,
  CupomClienteResumo,
  CupomResposta,
  FaixaCupom,
} from './entities/cupom.entity';
import { arredondarReais, calcularDesconto } from './cupom-desconto';

const PRIORIDADE: Record<PublicoCupom, number> = {
  [PublicoCupom.USUARIOS]: 3,
  [PublicoCupom.NOVOS_CLIENTES]: 2,
  [PublicoCupom.TODOS]: 1,
};

const STATUS_JA_COMPROU: StatusPedido[] = [
  StatusPedido.PAGO,
  StatusPedido.REEMBOLSO_SOLICITADO,
  StatusPedido.REEMBOLSADO,
];

const INCLUDE_USUARIOS = {
  usuarios: {
    include: {
      usuario: { select: { id: true, nome: true, email: true } },
    },
  },
} satisfies Prisma.CupomInclude;

type CupomComUsuarios = Prisma.CupomGetPayload<{
  include: typeof INCLUDE_USUARIOS;
}>;

@Injectable()
export class CuponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly usuariosService: UsuariosService,
  ) {}

  async listar(): Promise<CupomResposta[]> {
    const cupons = await this.prisma.cupom.findMany({
      include: this.includeUsuarios(),
      orderBy: { atualizadoEm: 'desc' },
    });
    const usos = await this.contarUsos(cupons.map((cupom) => cupom.id));
    return cupons.map((cupom) => this.paraResposta(cupom, usos.get(cupom.id) ?? 0));
  }

  async buscar(id: number): Promise<CupomResposta> {
    const cupom = await this.buscarOuFalhar(id);
    const usos = await this.contarUsos([id]);
    return this.paraResposta(cupom, usos.get(id) ?? 0);
  }

  async criar(dto: SalvarCupomDto): Promise<CupomResposta> {
    this.validarRegras(dto);
    const usuarioIds = await this.clientesValidos(dto);
    try {
      const cupom = await this.prisma.cupom.create({
        data: {
          ...this.dados(dto),
          usuarios: {
            create: usuarioIds.map((usuarioId) => ({ usuarioId })),
          },
        },
        include: this.includeUsuarios(),
      });
      return this.paraResposta(cupom, 0);
    } catch (erro) {
      this.traduzirCodigoDuplicado(erro);
      throw erro;
    }
  }

  async atualizar(id: number, dto: SalvarCupomDto): Promise<CupomResposta> {
    await this.buscarOuFalhar(id);
    this.validarRegras(dto);
    const usuarioIds = await this.clientesValidos(dto);
    try {
      const cupom = await this.prisma.cupom.update({
        where: { id },
        data: {
          ...this.dados(dto),
          usuarios: {
            deleteMany: {},
            create: usuarioIds.map((usuarioId) => ({ usuarioId })),
          },
        },
        include: this.includeUsuarios(),
      });
      const usos = await this.contarUsos([id]);
      return this.paraResposta(cupom, usos.get(id) ?? 0);
    } catch (erro) {
      this.traduzirCodigoDuplicado(erro);
      throw erro;
    }
  }

  async remover(id: number): Promise<void> {
    await this.buscarOuFalhar(id);
    const usos = await this.prisma.pedido.count({ where: { cupomId: id } });
    if (usos > 0) {
      throw new ConflictException(
        'Este cupom já entrou em pedidos. Pause ele em vez de excluir, para o histórico continuar fazendo sentido.',
      );
    }
    await this.prisma.cupom.delete({ where: { id } });
  }

  async buscarClientes(busca: string): Promise<CupomClienteResumo[]> {
    const termo = busca.trim();
    const clientes = await this.prisma.usuario.findMany({
      where: {
        perfil: PerfilUsuario.CLIENTE,
        ...(termo
          ? {
              OR: [
                { nome: { contains: termo, mode: 'insensitive' } },
                { email: { contains: termo, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, nome: true, email: true },
      orderBy: { nome: 'asc' },
      take: 20,
    });
    return clientes;
  }

  async faixaParaVisitante(authorization?: string): Promise<FaixaCupom | null> {
    const usuarioId = await this.usuarioIdDoToken(authorization);
    const cupom = await this.escolherFaixa(usuarioId);
    if (!cupom) {
      return null;
    }
    return {
      codigo: cupom.codigo,
      mensagem: cupom.mensagem,
      tipoDesconto: cupom.tipoDesconto as TipoDescontoCupom,
      valor: Number(cupom.valor),
    };
  }

  // Checkout e a simulação da tela usam a mesma checagem. O desconto é
  // sempre recalculado aqui a partir do subtotal real dos produtos.
  async aplicar(
    codigo: string,
    usuarioId: number,
    subtotal: number,
  ): Promise<CupomAplicado> {
    const normalizado = codigo.trim().toUpperCase();
    const cupom = await this.prisma.cupom.findUnique({
      where: { codigo: normalizado },
      include: { usuarios: { select: { usuarioId: true } } },
    });
    if (!cupom) {
      throw new BadRequestException('Cupom não encontrado.');
    }

    const motivo = await this.motivoRecusa(cupom, usuarioId, subtotal);
    if (motivo) {
      throw new BadRequestException(motivo);
    }

    return {
      cupomId: cupom.id,
      codigo: cupom.codigo,
      desconto: calcularDesconto({
        tipo: cupom.tipoDesconto as TipoDescontoCupom,
        valor: Number(cupom.valor),
        subtotal,
      }),
      mensagem: cupom.mensagem,
    };
  }

  private async escolherFaixa(usuarioId: number | null) {
    const agora = new Date();
    const cupons = await this.prisma.cupom.findMany({
      where: {
        ativo: true,
        mostrarNoTopo: true,
        AND: [
          { OR: [{ inicioEm: null }, { inicioEm: { lte: agora } }] },
          { OR: [{ fimEm: null }, { fimEm: { gte: agora } }] },
        ],
      },
      include: { usuarios: { select: { usuarioId: true } } },
    });
    const clienteNovo =
      usuarioId === null ? true : !(await this.jaComprou(usuarioId));
    const elegiveis: typeof cupons = [];
    for (const cupom of cupons) {
      if (cupom.publico === PublicoCupom.USUARIOS) {
        if (
          usuarioId === null ||
          !cupom.usuarios.some((linha) => linha.usuarioId === usuarioId)
        ) {
          continue;
        }
      }
      if (cupom.publico === PublicoCupom.NOVOS_CLIENTES && !clienteNovo) {
        continue;
      }
      if (await this.esgotado(cupom.id, cupom.limiteUsos)) {
        continue;
      }
      elegiveis.push(cupom);
    }
    elegiveis.sort((a, b) => {
      const prioridade =
        PRIORIDADE[b.publico as PublicoCupom] -
        PRIORIDADE[a.publico as PublicoCupom];
      if (prioridade !== 0) {
        return prioridade;
      }
      return b.atualizadoEm.getTime() - a.atualizadoEm.getTime();
    });
    return elegiveis[0] ?? null;
  }

  private async motivoRecusa(
    cupom: {
      id: number;
      ativo: boolean;
      publico: string;
      inicioEm: Date | null;
      fimEm: Date | null;
      valorMinimo: Prisma.Decimal | null;
      limiteUsos: number | null;
      usuarios: { usuarioId: number }[];
    },
    usuarioId: number,
    subtotal: number,
  ): Promise<string | null> {
    if (!cupom.ativo) {
      return 'Este cupom não está ativo.';
    }
    const agora = new Date();
    if (cupom.inicioEm && cupom.inicioEm > agora) {
      return 'Este cupom ainda não começou.';
    }
    if (cupom.fimEm && cupom.fimEm < agora) {
      return 'Este cupom já expirou.';
    }
    if (cupom.publico === PublicoCupom.USUARIOS) {
      const permitido = cupom.usuarios.some(
        (linha) => linha.usuarioId === usuarioId,
      );
      if (!permitido) {
        return 'Este cupom não está disponível para a sua conta.';
      }
    }
    if (
      cupom.publico === PublicoCupom.NOVOS_CLIENTES &&
      (await this.jaComprou(usuarioId))
    ) {
      return 'Este cupom é só para a primeira compra.';
    }
    if (cupom.valorMinimo !== null && subtotal < Number(cupom.valorMinimo)) {
      return `Este cupom vale para compras a partir de ${this.reais(Number(cupom.valorMinimo))} em produtos.`;
    }
    if (await this.esgotado(cupom.id, cupom.limiteUsos)) {
      return 'Este cupom já atingiu o limite de usos.';
    }
    return null;
  }

  private async esgotado(cupomId: number, limiteUsos: number | null) {
    if (limiteUsos === null) {
      return false;
    }
    const usos = await this.prisma.pedido.count({
      where: { cupomId, status: { not: StatusPedido.CANCELADO } },
    });
    return usos >= limiteUsos;
  }

  private jaComprou(usuarioId: number) {
    return this.prisma.pedido
      .count({
        where: { usuarioId, status: { in: STATUS_JA_COMPROU } },
      })
      .then((quantidade) => quantidade > 0);
  }

  private async usuarioIdDoToken(
    authorization?: string,
  ): Promise<number | null> {
    if (!authorization?.toLowerCase().startsWith('bearer ')) {
      return null;
    }
    const token = authorization.slice(7).trim();
    const secret = this.configService.get<string>('JWT_SECRET');
    if (!token || !secret) {
      return null;
    }
    try {
      const payload = verify(token, secret) as { sub?: unknown };
      const id = Number(payload.sub);
      if (!Number.isInteger(id) || id <= 0) {
        return null;
      }
      const usuario = await this.usuariosService.buscarAtivoPorId(id);
      return usuario?.id ?? null;
    } catch {
      return null;
    }
  }

  private validarRegras(dto: SalvarCupomDto) {
    if (dto.tipoDesconto === TipoDescontoCupom.PERCENTUAL && dto.valor > 100) {
      throw new BadRequestException('A porcentagem não pode passar de 100.');
    }
    if (
      dto.inicioEm &&
      dto.fimEm &&
      new Date(dto.fimEm).getTime() < new Date(dto.inicioEm).getTime()
    ) {
      throw new BadRequestException(
        'A data final precisa ser igual ou posterior à data inicial.',
      );
    }
    if (dto.publico === PublicoCupom.USUARIOS && !dto.usuarioIds?.length) {
      throw new BadRequestException('Escolha pelo menos um cliente.');
    }
  }

  private async clientesValidos(dto: SalvarCupomDto): Promise<number[]> {
    if (dto.publico !== PublicoCupom.USUARIOS) {
      return [];
    }
    const ids = dto.usuarioIds ?? [];
    const clientes = await this.prisma.usuario.findMany({
      where: { id: { in: ids }, perfil: PerfilUsuario.CLIENTE },
      select: { id: true },
    });
    if (clientes.length !== ids.length) {
      throw new BadRequestException(
        'Um dos clientes escolhidos não existe ou não é um cliente da loja.',
      );
    }
    return ids;
  }

  private dados(dto: SalvarCupomDto): Prisma.CupomCreateInput {
    return {
      codigo: dto.codigo,
      mensagem: dto.mensagem,
      tipoDesconto: dto.tipoDesconto,
      valor: arredondarReais(dto.valor),
      publico: dto.publico,
      ativo: dto.ativo,
      mostrarNoTopo: dto.mostrarNoTopo,
      valorMinimo:
        dto.valorMinimo == null ? null : arredondarReais(dto.valorMinimo),
      limiteUsos: dto.limiteUsos ?? null,
      inicioEm: dto.inicioEm ? new Date(dto.inicioEm) : null,
      fimEm: dto.fimEm ? new Date(dto.fimEm) : null,
    };
  }

  private includeUsuarios() {
    return INCLUDE_USUARIOS;
  }

  private async buscarOuFalhar(id: number): Promise<CupomComUsuarios> {
    const cupom = await this.prisma.cupom.findUnique({
      where: { id },
      include: this.includeUsuarios(),
    });
    if (!cupom) {
      throw new NotFoundException('Cupom não encontrado.');
    }
    return cupom;
  }

  private async contarUsos(ids: number[]) {
    if (ids.length === 0) {
      return new Map<number, number>();
    }
    const grupos = await this.prisma.pedido.groupBy({
      by: ['cupomId'],
      where: {
        cupomId: { in: ids },
        status: { not: StatusPedido.CANCELADO },
      },
      _count: { _all: true },
    });
    return new Map(
      grupos
        .filter((grupo) => grupo.cupomId !== null)
        .map((grupo) => [grupo.cupomId as number, grupo._count._all]),
    );
  }

  private paraResposta(cupom: CupomComUsuarios, usos: number): CupomResposta {
    return {
      id: cupom.id,
      codigo: cupom.codigo,
      mensagem: cupom.mensagem,
      tipoDesconto: cupom.tipoDesconto as TipoDescontoCupom,
      valor: Number(cupom.valor),
      publico: cupom.publico as PublicoCupom,
      ativo: cupom.ativo,
      mostrarNoTopo: cupom.mostrarNoTopo,
      valorMinimo: cupom.valorMinimo === null ? null : Number(cupom.valorMinimo),
      limiteUsos: cupom.limiteUsos,
      usos,
      inicioEm: cupom.inicioEm,
      fimEm: cupom.fimEm,
      usuarios: cupom.usuarios
        .map((linha) => linha.usuario)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    };
  }

  private traduzirCodigoDuplicado(erro: unknown): void {
    if (
      erro instanceof Prisma.PrismaClientKnownRequestError &&
      erro.code === 'P2002'
    ) {
      throw new ConflictException('Já existe um cupom com esse código.');
    }
  }

  private reais(valor: number): string {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }
}
