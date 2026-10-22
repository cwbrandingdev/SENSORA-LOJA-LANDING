import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PropostaEmpresa } from '../../generated/prisma/client';
import { escaparHtml } from '../common/utils/html.util';
import {
  normalizarTelefone,
  telefoneValido,
} from '../common/utils/telefone.util';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { CriarPropostaEmpresaDto } from './dto/criar-proposta-empresa.dto';
import { StatusProposta } from './dto/atualizar-status-proposta.dto';

// Além dos admins ativos, sempre avisado.
const EMAIL_EQUIPE_COMERCIAL = 'contato@sensorahome.com.br';
const CAMINHO_ADMIN_EMPRESAS = '/workspace-x/empresas';
const LIMITE_LISTAGEM = 200;

@Injectable()
export class PropostasEmpresasService {
  private readonly logger = new Logger(PropostasEmpresasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  async criar(dto: CriarPropostaEmpresaDto): Promise<{ recebida: true }> {
    // Robô (campo escondido preenchido): responde igual, sem gravar nada.
    if (dto.site) {
      return { recebida: true };
    }
    if (!telefoneValido(dto.telefone)) {
      throw new BadRequestException('Informe um telefone com DDD.');
    }
    const nome = dto.nome.trim();
    const empresa = dto.empresa.trim();
    if (!nome || !empresa) {
      throw new BadRequestException('Informe seu nome e o nome da empresa.');
    }

    const proposta = await this.prisma.propostaEmpresa.create({
      data: {
        nome,
        email: dto.email,
        telefone: normalizarTelefone(dto.telefone),
        empresa,
        cargo: dto.cargo,
        objetivo: dto.objetivo,
        quantidade: dto.quantidade,
        mensagem: dto.mensagem?.trim() || null,
      },
    });
    await this.avisarEquipe(proposta);
    return { recebida: true };
  }

  listar(): Promise<PropostaEmpresa[]> {
    return this.prisma.propostaEmpresa.findMany({
      orderBy: { criadaEm: 'desc' },
      take: LIMITE_LISTAGEM,
    });
  }

  async atualizarStatus(
    id: number,
    status: StatusProposta,
  ): Promise<PropostaEmpresa> {
    const { count } = await this.prisma.propostaEmpresa.updateMany({
      where: { id },
      data: { status },
    });
    if (count === 0) {
      throw new NotFoundException(`Proposta ${id} não encontrada.`);
    }
    return this.prisma.propostaEmpresa.findUniqueOrThrow({ where: { id } });
  }

  // Um e-mail por endereço (admins ativos + equipe comercial, sem
  // repetidos). Nunca lança: a proposta já está gravada e aparece no Admin.
  // Todo texto do formulário é escapado; nenhum log leva dado do cliente.
  private async avisarEquipe(proposta: PropostaEmpresa): Promise<void> {
    try {
      const admins = await this.prisma.usuario.findMany({
        where: { perfil: PerfilUsuario.ADMIN, ativo: true },
        select: { email: true },
      });
      const destinatarios = new Set(
        [...admins.map((a) => a.email), EMAIL_EQUIPE_COMERCIAL].map((e) =>
          e.trim().toLowerCase(),
        ),
      );

      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      const acesso = frontendUrl
        ? `<p><a href="${escaparHtml(`${frontendUrl.replace(/\/$/, '')}${CAMINHO_ADMIN_EMPRESAS}`)}">Ver no painel</a></p>`
        : '<p>Acesse o painel administrativo, em Empresas, para ver a proposta.</p>';
      const html =
        '<p>Um novo pedido de proposta para empresas chegou pelo site.</p>' +
        `<p>Empresa: ${escaparHtml(proposta.empresa)}<br>` +
        `Contato: ${escaparHtml(proposta.nome)} (${escaparHtml(proposta.cargo)})<br>` +
        `E-mail: ${escaparHtml(proposta.email)}<br>` +
        `Telefone: ${escaparHtml(proposta.telefone)}</p>` +
        `<p>Objetivo: ${escaparHtml(proposta.objetivo)}<br>` +
        `Quantidade: ${escaparHtml(proposta.quantidade)}</p>` +
        (proposta.mensagem
          ? `<p>Mensagem:<br>${escaparHtml(proposta.mensagem).replace(/\n/g, '<br>')}</p>`
          : '') +
        acesso;
      const subject = `Proposta para empresas — ${proposta.empresa}`;

      for (const to of destinatarios) {
        try {
          await this.mailService.enviarEmail({ to, subject, html });
        } catch (erro) {
          this.logger.error(
            `Falha ao avisar um destinatário sobre a proposta ${proposta.id}.`,
            erro instanceof Error ? erro.stack : String(erro),
          );
        }
      }
    } catch (erro) {
      this.logger.error(
        `Falha ao avisar a equipe sobre a proposta ${proposta.id}.`,
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }
}
