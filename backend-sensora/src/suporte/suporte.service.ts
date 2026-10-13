import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Prisma,
  type SolicitacaoSuporte as SolicitacaoSuportePrisma,
} from '../../generated/prisma/client';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { escaparHtml } from '../common/utils/html.util';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { AtualizarStatusSuporteDto } from './dto/atualizar-status-suporte.dto';
import { CreateSolicitacaoSuporteDto } from './dto/create-solicitacao-suporte.dto';
import { ListarSolicitacoesSuporteQueryDto } from './dto/listar-solicitacoes-suporte.dto';
import {
  PaginaSolicitacoesSuporte,
  SolicitacaoSuporteCriada,
  SolicitacaoSuporteDetalhe,
  SolicitacaoSuporteResumo,
} from './entities/solicitacao-suporte.entity';
import {
  CategoriaSuporte,
  ROTULOS_CATEGORIA_SUPORTE,
} from './enums/categoria-suporte.enum';
import { StatusSolicitacaoSuporte } from './enums/status-solicitacao-suporte.enum';

// Proteção contra REPETIÇÃO ACIDENTAL (clique duplo, reenvio do navegador),
// mesmo raciocínio de JANELA_REPETICAO_DEVOLUCAO_MS: a mesma solicitação
// (mesmo cliente, categoria, assunto e mensagem, ainda ABERTA) feita de novo dentro
// desta janela devolve a que já existe, sem criar outra nem avisar os
// admins de novo. Qualquer diferença cria outra solicitação normalmente.
export const JANELA_REPETICAO_SUPORTE_MS = 60 * 1000;

// Caixas da Sensora que também recebem o aviso de toda nova solicitação,
// além dos ADMINs ativos (frontend: EMPRESA.email/emailSuporte em
// lib/empresa.ts).
export const EMAILS_FIXOS_AVISO_SUPORTE = [
  'contato@sensorahome.com.br',
  'suporte@sensorahome.com.br',
];

// Caminho da solicitação no painel (frontend: ROUTES.SUPORTE em
// lib/routes.ts). Vai no e-mail de aviso aos admins.
const CAMINHO_ADMIN_SUPORTE = '/workspace-x/suporte';

// Assunto numa linha só: caracteres de controle (inclusive quebras de
// linha, que não podem chegar ao assunto do e-mail) viram espaço e
// sequências de espaços viram um.
function normalizarAssunto(texto: string): string {
  return texto
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mensagem mantém as quebras de linha do cliente; só uniformiza CRLF e
// tira os espaços das pontas.
function normalizarMensagem(texto: string): string {
  return texto.replace(/\r\n?/g, '\n').trim();
}

// Só para comparar duas solicitações (mesma regra de textoComparavel em
// devolucoes.service.ts): ignora diferenças de espaços e quebras de linha.
function textoComparavel(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}

@Injectable()
export class SuporteService {
  private readonly logger = new Logger(SuporteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  // Cliente abre uma solicitação. Usuário, nome e e-mail vêm sempre do
  // token e do cadastro no banco — do corpo da requisição só vêm assunto e
  // mensagem. Grava primeiro; o aviso aos admins vem depois e nunca desfaz
  // nem transforma em erro uma gravação bem-sucedida.
  async criar(
    dto: CreateSolicitacaoSuporteDto,
    user: UsuarioAutenticado,
  ): Promise<SolicitacaoSuporteCriada> {
    const assunto = normalizarAssunto(dto.assunto);
    const mensagem = normalizarMensagem(dto.mensagem);
    if (!assunto) {
      throw new BadRequestException('Informe o assunto.');
    }
    if (!mensagem) {
      throw new BadRequestException('Escreva a mensagem.');
    }

    const { solicitacao, criada } = await this.prisma.$transaction(
      async (tx) => {
        // Trava a linha do usuário até o fim da transação: dois envios
        // simultâneos do mesmo cliente passam por aqui um de cada vez, e o
        // segundo já enxerga o primeiro na checagem de repetição.
        await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${user.id} FOR UPDATE`;

        const usuario = await tx.usuario.findUnique({
          where: { id: user.id },
          select: { nome: true, email: true },
        });
        if (!usuario) {
          throw new NotFoundException('Usuário não encontrado.');
        }

        const recentes = await tx.solicitacaoSuporte.findMany({
          where: {
            usuarioId: user.id,
            status: StatusSolicitacaoSuporte.ABERTA,
            criadaEm: {
              gte: new Date(Date.now() - JANELA_REPETICAO_SUPORTE_MS),
            },
          },
        });
        const repetida = recentes.find(
          (recente) =>
            (recente.categoria as CategoriaSuporte) === dto.categoria &&
            textoComparavel(recente.assunto) === textoComparavel(assunto) &&
            textoComparavel(recente.mensagem) === textoComparavel(mensagem),
        );
        if (repetida) {
          return { solicitacao: repetida, criada: false };
        }

        const nova = await tx.solicitacaoSuporte.create({
          data: {
            usuarioId: user.id,
            nome: usuario.nome,
            email: usuario.email,
            categoria: dto.categoria,
            assunto,
            mensagem,
          },
        });
        return { solicitacao: nova, criada: true };
      },
    );

    // Só depois de a transação terminar, e só para uma solicitação nova (a
    // repetição reaproveitada não avisa de novo). Nunca lança.
    if (criada) {
      await this.avisarAdminsNovaSolicitacao(solicitacao);
    }

    return {
      id: solicitacao.id,
      categoria: solicitacao.categoria as CategoriaSuporte,
      assunto: solicitacao.assunto,
      status: solicitacao.status as StatusSolicitacaoSuporte,
      criadaEm: solicitacao.criadaEm,
    };
  }

  async listarParaAdmin(
    filtros: ListarSolicitacoesSuporteQueryDto,
  ): Promise<PaginaSolicitacoesSuporte> {
    const { page, pageSize } = filtros;
    const where: Prisma.SolicitacaoSuporteWhereInput = {
      ...(filtros.status ? { status: filtros.status } : {}),
      ...(filtros.categoria ? { categoria: filtros.categoria } : {}),
    };

    const [registros, total] = await Promise.all([
      this.prisma.solicitacaoSuporte.findMany({
        where,
        orderBy: [{ criadaEm: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.solicitacaoSuporte.count({ where }),
    ]);

    return {
      items: registros.map((registro) => this.paraResumo(registro)),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async buscarParaAdmin(id: number): Promise<SolicitacaoSuporteDetalhe> {
    const registro = await this.prisma.solicitacaoSuporte.findUnique({
      where: { id },
    });
    if (!registro) {
      throw new NotFoundException(
        `Solicitação de suporte ${id} não encontrada.`,
      );
    }
    return this.paraDetalhe(registro);
  }

  // Mesmo status de agora: nada é gravado (atualizadaEm fica como está).
  // O DTO já limita o destino a EM_ATENDIMENTO ou RESOLVIDA.
  async atualizarStatus(
    id: number,
    dto: AtualizarStatusSuporteDto,
  ): Promise<SolicitacaoSuporteDetalhe> {
    const atual = await this.prisma.solicitacaoSuporte.findUnique({
      where: { id },
    });
    if (!atual) {
      throw new NotFoundException(
        `Solicitação de suporte ${id} não encontrada.`,
      );
    }
    if ((atual.status as StatusSolicitacaoSuporte) === dto.status) {
      return this.paraDetalhe(atual);
    }

    const atualizada = await this.prisma.solicitacaoSuporte.update({
      where: { id },
      data: { status: dto.status },
    });
    return this.paraDetalhe(atualizada);
  }

  // E-mail a cada ADMIN ativo e a cada endereço de EMAILS_FIXOS_AVISO_SUPORTE
  // (mesmo padrão de avisarAdminsNovaSolicitacao em devolucoes.service.ts).
  // Um envio por endereço — repetidos (sem diferenciar maiúsculas) recebem
  // uma vez só —, cada um isolado: a falha de um não impede os outros. Todo
  // texto do cliente é escapado antes de entrar no HTML. Nunca lança: a
  // solicitação já está gravada e não depende do e-mail. Nenhum log leva
  // nome, e-mail ou texto do cliente.
  private async avisarAdminsNovaSolicitacao(
    solicitacao: SolicitacaoSuportePrisma,
  ): Promise<void> {
    try {
      const admins = await this.prisma.usuario.findMany({
        where: { perfil: PerfilUsuario.ADMIN, ativo: true },
        select: { id: true, email: true },
      });
      if (admins.length === 0) {
        this.logger.warn(
          `Nenhum administrador ativo — aviso da solicitação de suporte ${solicitacao.id} vai só para os endereços fixos.`,
        );
      }

      // Rótulo só para o log (nunca o endereço).
      const destinatarios = new Map<
        string,
        { email: string; rotulo: string }
      >();
      for (const admin of admins) {
        destinatarios.set(admin.email.trim().toLowerCase(), {
          email: admin.email,
          rotulo: `o admin ${admin.id}`,
        });
      }
      EMAILS_FIXOS_AVISO_SUPORTE.forEach((email, i) => {
        const chave = email.trim().toLowerCase();
        if (!destinatarios.has(chave)) {
          destinatarios.set(chave, {
            email,
            rotulo: `o endereço fixo ${i + 1}`,
          });
        }
      });

      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const acesso = frontendUrl
        ? `<p><a href="${escaparHtml(`${frontendUrl.replace(/\/$/, '')}${CAMINHO_ADMIN_SUPORTE}/${solicitacao.id}`)}">Ver a solicitação no painel</a></p>`
        : '<p>Acesse o painel administrativo, em Suporte, para ver a solicitação.</p>';
      const categoria =
        ROTULOS_CATEGORIA_SUPORTE[solicitacao.categoria as CategoriaSuporte];
      const quando = solicitacao.criadaEm.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        dateStyle: 'short',
        timeStyle: 'short',
      });

      const html =
        '<p>Uma nova solicitação de suporte foi registrada.</p>' +
        `<p>Cliente: ${escaparHtml(solicitacao.nome)} (${escaparHtml(solicitacao.email)})</p>` +
        `<p>Data: ${escaparHtml(quando)}</p>` +
        `<p>Categoria: ${escaparHtml(categoria)}</p>` +
        `<p>Assunto: ${escaparHtml(solicitacao.assunto)}</p>` +
        `<p>Mensagem:<br>${escaparHtml(solicitacao.mensagem).replace(/\n/g, '<br>')}</p>` +
        acesso +
        '<p>Responda ao cliente por e-mail, no endereço acima.</p>';
      // O assunto já foi normalizado para uma linha só (normalizarAssunto).
      const subject = `Nova solicitação de suporte (${categoria}) — ${solicitacao.assunto}`;

      for (const destinatario of destinatarios.values()) {
        try {
          await this.mailService.enviarEmail({
            to: destinatario.email,
            subject,
            html,
          });
        } catch (erro) {
          // Sem o endereço no log (mesma política do MailService).
          this.logger.error(
            `Falha ao avisar ${destinatario.rotulo} sobre a solicitação de suporte ${solicitacao.id}.`,
            erro instanceof Error ? erro.stack : String(erro),
          );
        }
      }
      this.logger.log(
        `Aviso da solicitação de suporte ${solicitacao.id} enviado ao provedor para ${destinatarios.size} destinatário(s) (${admins.length} administrador(es) ativo(s) e os endereços fixos).`,
      );
    } catch (erro) {
      this.logger.error(
        `Falha ao avisar os admins sobre a solicitação de suporte ${solicitacao.id}.`,
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }

  // Lista explícita de campos: nada além do necessário sai pela API.
  private paraResumo(
    registro: SolicitacaoSuportePrisma,
  ): SolicitacaoSuporteResumo {
    return {
      id: registro.id,
      nome: registro.nome,
      email: registro.email,
      categoria: registro.categoria as CategoriaSuporte,
      assunto: registro.assunto,
      status: registro.status as StatusSolicitacaoSuporte,
      criadaEm: registro.criadaEm,
      atualizadaEm: registro.atualizadaEm,
    };
  }

  private paraDetalhe(
    registro: SolicitacaoSuportePrisma,
  ): SolicitacaoSuporteDetalhe {
    return {
      ...this.paraResumo(registro),
      usuarioId: registro.usuarioId,
      mensagem: registro.mensagem,
    };
  }
}
