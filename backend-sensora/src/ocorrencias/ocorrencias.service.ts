import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListarOcorrenciasQueryDto } from './dto/listar-ocorrencias.dto';
import {
  DetalhesOcorrencia,
  OcorrenciaResposta,
  PaginaOcorrencias,
} from './entities/ocorrencia.entity';
import { ResultadoOcorrencia } from './enums/resultado-ocorrencia.enum';
import { TipoOcorrencia } from './enums/tipo-ocorrencia.enum';

const RETENCAO_MS = 30 * 24 * 60 * 60 * 1000;
const INTERVALO_LIMPEZA_MS = 60 * 60 * 1000;
const LIMITE_MENSAGEM = 500;
const LIMITE_CAMPO = 200;

const CHAVES_NUMERICAS = [
  'produtoId',
  'quantidadePedida',
  'quantidadeDisponivel',
  'unidadesDevolvidas',
] as const satisfies readonly (keyof DetalhesOcorrencia)[];
const CHAVES_TEXTO = [
  'produtoNome',
  'evento',
  'statusAnterior',
  'statusAtual',
  'asaasCode',
  'asaasDescription',
] as const satisfies readonly (keyof DetalhesOcorrencia)[];

export interface RegistrarOcorrenciaInput {
  tipo: TipoOcorrencia;
  resultado: ResultadoOcorrencia;
  codigo: string;
  etapa: string;
  mensagem: string;
  usuarioId?: number | null;
  pedidoId?: number | null;
  devolucaoId?: number | null;
  pedidoNumero?: string | null;
  valor?: number | null;
  gateway?: string | null;
  referenciaExterna?: string | null;
  detalhes?: DetalhesOcorrencia;
  // Só para eventos que podem se repetir (ex.: webhook reenviado). Sem ela,
  // duas tentativas legítimas geram duas ocorrências.
  chaveIdempotencia?: string | null;
}

// CRIADA: gravou. DUPLICADA: a chave de idempotência já existia (esperado,
// ex.: webhook reenviado). FALHOU: erro ao gravar, só registrado no log.
export type ResultadoRegistro = 'CRIADA' | 'DUPLICADA' | 'FALHOU';

// Ocorrências de negócio (checkout, pagamento, reembolso, devolução). O
// registro NUNCA lança: uma falha aqui nunca pode derrubar o fluxo que a
// chamou — quem registra pode chamar sem try/catch. Sem chamadas externas e
// sem transação própria: quem chama deve registrar FORA de qualquer
// transação de negócio (uma ocorrência gravada dentro dela seria desfeita
// junto com uma falha).
@Injectable()
export class OcorrenciasService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OcorrenciasService.name);
  private limpezaTimer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  // Retenção de 30 dias: limpeza ao subir e depois a cada hora. Idempotente
  // (várias máquinas podem rodar ao mesmo tempo) e `.unref()` para não
  // segurar o encerramento do processo.
  onModuleInit(): void {
    void this.removerAntigas();
    this.limpezaTimer = setInterval(
      () => void this.removerAntigas(),
      INTERVALO_LIMPEZA_MS,
    );
    this.limpezaTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.limpezaTimer) clearInterval(this.limpezaTimer);
  }

  async registrar(input: RegistrarOcorrenciaInput): Promise<ResultadoRegistro> {
    try {
      const detalhes = this.sanitizarDetalhes(input.detalhes);
      await this.prisma.ocorrencia.create({
        data: {
          tipo: input.tipo,
          resultado: input.resultado,
          codigo: this.texto(input.codigo, LIMITE_CAMPO),
          etapa: this.texto(input.etapa, LIMITE_CAMPO),
          mensagem: this.texto(input.mensagem, LIMITE_MENSAGEM),
          usuarioId: input.usuarioId ?? null,
          pedidoId: input.pedidoId ?? null,
          devolucaoId: input.devolucaoId ?? null,
          pedidoNumero: this.textoOpcional(input.pedidoNumero),
          valor: input.valor ?? null,
          gateway: this.textoOpcional(input.gateway),
          referenciaExterna: this.textoOpcional(input.referenciaExterna),
          ...(detalhes ? { detalhes } : {}),
          chaveIdempotencia: this.textoOpcional(input.chaveIdempotencia),
        },
      });
      return 'CRIADA';
    } catch (erro) {
      if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === 'P2002'
      ) {
        return 'DUPLICADA';
      }
      this.logger.error(
        `Falha ao registrar a ocorrência ${input.codigo}.`,
        erro instanceof Error ? erro.stack : String(erro),
      );
      return 'FALHOU';
    }
  }

  async removerAntigas(): Promise<void> {
    try {
      await this.prisma.ocorrencia.deleteMany({
        where: { criadoEm: { lt: this.dataLimite() } },
      });
    } catch (erro) {
      this.logger.warn(
        `Não foi possível remover ocorrências antigas: ${
          erro instanceof Error ? erro.message : String(erro)
        }`,
      );
    }
  }

  // Só os últimos 30 dias, mesmo que a limpeza ainda não tenha rodado.
  async listar(filtros: ListarOcorrenciasQueryDto): Promise<PaginaOcorrencias> {
    const { page, pageSize } = filtros;
    const limite = this.dataLimite();
    const inicio = filtros.dataInicio ? new Date(filtros.dataInicio) : limite;
    const where: Prisma.OcorrenciaWhereInput = {
      criadoEm: {
        gte: inicio > limite ? inicio : limite,
        ...(filtros.dataFim ? { lte: this.fimDoPeriodo(filtros.dataFim) } : {}),
      },
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.resultado ? { resultado: filtros.resultado } : {}),
      ...(filtros.codigo ? { codigo: filtros.codigo } : {}),
      ...(filtros.usuarioId ? { usuarioId: filtros.usuarioId } : {}),
      ...(filtros.pedidoId ? { pedidoId: filtros.pedidoId } : {}),
      ...(filtros.devolucaoId ? { devolucaoId: filtros.devolucaoId } : {}),
    };

    const [registros, total] = await Promise.all([
      this.prisma.ocorrencia.findMany({
        where,
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { usuario: { select: { nome: true, email: true } } },
      }),
      this.prisma.ocorrencia.count({ where }),
    ]);

    return {
      items: registros.map((registro) => this.paraResposta(registro)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // Lista explícita de campos: nada além do modelo sai pela API.
  private paraResposta(
    registro: Prisma.OcorrenciaGetPayload<{
      include: { usuario: { select: { nome: true; email: true } } };
    }>,
  ): OcorrenciaResposta {
    return {
      id: registro.id,
      criadoEm: registro.criadoEm,
      tipo: registro.tipo as TipoOcorrencia,
      resultado: registro.resultado as ResultadoOcorrencia,
      codigo: registro.codigo,
      etapa: registro.etapa,
      mensagem: registro.mensagem,
      usuarioId: registro.usuarioId,
      cliente: registro.usuario
        ? { nome: registro.usuario.nome, email: registro.usuario.email }
        : null,
      pedidoId: registro.pedidoId,
      devolucaoId: registro.devolucaoId,
      pedidoNumero: registro.pedidoNumero,
      valor: registro.valor === null ? null : Number(registro.valor),
      gateway: registro.gateway,
      referenciaExterna: registro.referenciaExterna,
      detalhes: (registro.detalhes as DetalhesOcorrencia | null) ?? null,
    };
  }

  // Só as chaves conhecidas; números finitos e textos curtos. Qualquer outra
  // coisa (objeto, chave desconhecida, payload) é descartada.
  private sanitizarDetalhes(
    detalhes: DetalhesOcorrencia | undefined,
  ): Record<string, number | string> | undefined {
    if (!detalhes) return undefined;
    const limpo: Record<string, number | string> = {};
    for (const chave of CHAVES_NUMERICAS) {
      const valor: unknown = detalhes[chave];
      if (typeof valor === 'number' && Number.isFinite(valor)) {
        limpo[chave] = valor;
      }
    }
    for (const chave of CHAVES_TEXTO) {
      const valor: unknown = detalhes[chave];
      if (typeof valor === 'string' && valor.length > 0) {
        limpo[chave] = valor.slice(0, LIMITE_CAMPO);
      }
    }
    return Object.keys(limpo).length > 0 ? limpo : undefined;
  }

  private texto(valor: string, limite: number): string {
    return valor.slice(0, limite);
  }

  private textoOpcional(valor: string | null | undefined): string | null {
    return valor ? valor.slice(0, LIMITE_CAMPO) : null;
  }

  private dataLimite(): Date {
    return new Date(Date.now() - RETENCAO_MS);
  }

  // `dataFim` só com a data (AAAA-MM-DD) vale até o fim daquele dia (UTC).
  private fimDoPeriodo(dataFim: string): Date {
    return /^\d{4}-\d{2}-\d{2}$/.test(dataFim)
      ? new Date(`${dataFim}T23:59:59.999Z`)
      : new Date(dataFim);
  }
}
