import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { CreateSolicitacaoSuporteDto } from './dto/create-solicitacao-suporte.dto';
import { CategoriaSuporte } from './enums/categoria-suporte.enum';
import { StatusSolicitacaoSuporte } from './enums/status-solicitacao-suporte.enum';
import { JANELA_REPETICAO_SUPORTE_MS, SuporteService } from './suporte.service';

// Prisma MOCKADO com um "banco" em memória (mesmo padrão de
// devolucoes.service.spec.ts): nenhum banco real, nenhum dado persistente,
// MailService simulado — nenhum e-mail é enviado.

const CLIENTE: UsuarioAutenticado = {
  id: 7,
  email: 'token@sensora.dev',
  perfil: PerfilUsuario.CLIENTE,
};

const ADMIN_1 = { id: 1, email: 'admin1@sensora.dev' };
const ADMIN_2 = { id: 2, email: 'admin2@sensora.dev' };

// Caixas da Sensora que recebem todo aviso, além dos ADMINs ativos.
const CONTATO = 'contato@sensorahome.com.br';
const SUPORTE = 'suporte@sensorahome.com.br';

const AGORA = new Date('2026-10-13T15:00:00Z');

type SolicitacaoFake = {
  id: number;
  usuarioId: number;
  categoria: CategoriaSuporte;
  nome: string;
  email: string;
  assunto: string;
  mensagem: string;
  status: StatusSolicitacaoSuporte;
  criadaEm: Date;
  atualizadaEm: Date;
};

type FiltroFake = {
  usuarioId?: number;
  status?: StatusSolicitacaoSuporte;
  categoria?: CategoriaSuporte;
  criadaEm?: { gte: Date };
};

function atende(s: SolicitacaoFake, where: FiltroFake): boolean {
  return (
    (where.usuarioId === undefined || s.usuarioId === where.usuarioId) &&
    (where.status === undefined || s.status === where.status) &&
    (where.categoria === undefined || s.categoria === where.categoria) &&
    (where.criadaEm === undefined || s.criadaEm >= where.criadaEm.gte)
  );
}

describe('SuporteService', () => {
  let service: SuporteService;
  let banco: SolicitacaoFake[];
  let usuarioFake: { nome: string; email: string } | null;
  let admins: { id: number; email: string }[];
  let frontendUrl: string | undefined;
  let enviarEmail: jest.Mock;
  let buscarAdmins: jest.Mock;
  let criarRegistro: jest.Mock;
  let atualizarRegistro: jest.Mock;
  let queryRaw: jest.Mock;
  let infoLog: jest.SpyInstance;
  let avisoLog: jest.SpyInstance;
  let erroLog: jest.SpyInstance;

  beforeEach(async () => {
    banco = [];
    usuarioFake = { nome: 'Ana Souza', email: 'ana@sensora.dev' };
    admins = [ADMIN_1, ADMIN_2];
    frontendUrl = 'https://sensorahome.com.br';
    enviarEmail = jest.fn().mockResolvedValue(undefined);
    queryRaw = jest.fn();
    jest.spyOn(Date, 'now').mockReturnValue(AGORA.getTime());
    infoLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    avisoLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    erroLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    criarRegistro = jest.fn(
      ({
        data,
      }: {
        data: Omit<
          SolicitacaoFake,
          'id' | 'status' | 'criadaEm' | 'atualizadaEm'
        >;
      }) => {
        const nova: SolicitacaoFake = {
          ...data,
          id: banco.length + 1,
          status: StatusSolicitacaoSuporte.ABERTA,
          criadaEm: new Date(Date.now()),
          atualizadaEm: new Date(Date.now()),
        };
        banco.push(nova);
        return nova;
      },
    );
    atualizarRegistro = jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: number };
        data: { status: StatusSolicitacaoSuporte };
      }) => {
        const registro = banco.find((s) => s.id === where.id)!;
        Object.assign(registro, data, { atualizadaEm: new Date(Date.now()) });
        return { ...registro };
      },
    );
    buscarAdmins = jest.fn(() => admins);

    const solicitacaoSuporte = {
      findMany: jest.fn(
        ({
          where,
          skip,
          take,
        }: {
          where: FiltroFake;
          skip?: number;
          take?: number;
        }) => {
          const filtrados = banco.filter((s) => atende(s, where));
          return filtrados.slice(
            skip ?? 0,
            (skip ?? 0) + (take ?? filtrados.length),
          );
        },
      ),
      count: jest.fn(
        ({ where }: { where: FiltroFake }) =>
          banco.filter((s) => atende(s, where)).length,
      ),
      findUnique: jest.fn(({ where }: { where: { id: number } }) => {
        const registro = banco.find((s) => s.id === where.id);
        return registro ? { ...registro } : null;
      }),
      create: criarRegistro,
      update: atualizarRegistro,
    };

    const prisma = {
      solicitacaoSuporte,
      usuario: { findMany: buscarAdmins },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            $queryRaw: (sql: TemplateStringsArray, ...valores: unknown[]) => {
              queryRaw(sql, ...valores);
            },
            usuario: { findUnique: jest.fn(() => usuarioFake) },
            solicitacaoSuporte,
          }),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        SuporteService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: { enviarEmail } },
        {
          provide: ConfigService,
          useValue: {
            get: (chave: string) =>
              chave === 'FRONTEND_URL' ? frontendUrl : undefined,
          },
        },
      ],
    }).compile();

    service = module.get(SuporteService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Categoria padrão dos testes que não tratam dela.
  function criar(
    corpo: Omit<CreateSolicitacaoSuporteDto, 'categoria'> & {
      categoria?: CategoriaSuporte;
    },
    user: UsuarioAutenticado,
  ) {
    return service.criar(
      { categoria: CategoriaSuporte.PEDIDO_ENTREGA, ...corpo },
      user,
    );
  }

  function enviados(): { to: string; subject: string; html: string }[] {
    return (
      enviarEmail.mock.calls as [
        { to: string; subject: string; html: string },
      ][]
    ).map(([params]) => params);
  }

  // -------------------------------------------------------------------
  // Criação
  // -------------------------------------------------------------------

  it('grava com usuário, nome e e-mail da conta (nunca do corpo), a categoria escolhida, e devolve o resumo', async () => {
    const resultado = await criar(
      {
        categoria: CategoriaSuporte.PRODUTO,
        assunto: 'Dúvida sobre a vela',
        mensagem: 'Qual o tempo de queima?',
      },
      CLIENTE,
    );

    expect(criarRegistro).toHaveBeenCalledWith({
      data: {
        usuarioId: CLIENTE.id,
        nome: 'Ana Souza',
        email: 'ana@sensora.dev',
        categoria: CategoriaSuporte.PRODUTO,
        assunto: 'Dúvida sobre a vela',
        mensagem: 'Qual o tempo de queima?',
      },
    });
    expect(resultado).toEqual({
      id: 1,
      categoria: CategoriaSuporte.PRODUTO,
      assunto: 'Dúvida sobre a vela',
      status: StatusSolicitacaoSuporte.ABERTA,
      criadaEm: AGORA,
    });
    expect(banco).toHaveLength(1);
  });

  it('trava a linha do usuário (SELECT ... FOR UPDATE) antes de conferir a repetição', async () => {
    await criar({ assunto: 'A', mensagem: 'B' }, CLIENTE);

    const [partes, ...valores] = queryRaw.mock.calls[0] as [
      string[],
      ...unknown[],
    ];
    expect(partes.join('?')).toContain('FOR UPDATE');
    expect(valores).toEqual([CLIENTE.id]);
  });

  it('normaliza: assunto numa linha só, mensagem com CRLF -> LF e sem espaços nas pontas', async () => {
    await criar(
      {
        assunto: '  Pedido\r\nBcc: x@y.com\t atrasado  ',
        mensagem: '  Olá,\r\n\r\nmeu pedido não chegou.  ',
      },
      CLIENTE,
    );

    expect(banco[0].assunto).toBe('Pedido Bcc: x@y.com atrasado');
    expect(banco[0].mensagem).toBe('Olá,\n\nmeu pedido não chegou.');
    const [{ subject }] = enviados();
    expect(subject).toBe(
      'Nova solicitação de suporte (Pedido e entrega) — Pedido Bcc: x@y.com atrasado',
    );
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it.each([
    [{ assunto: '   ', mensagem: 'Texto' }, 'Informe o assunto.'],
    [{ assunto: '\r\n\t', mensagem: 'Texto' }, 'Informe o assunto.'],
    [{ assunto: 'Assunto', mensagem: ' \n \n ' }, 'Escreva a mensagem.'],
  ])(
    'texto só com espaços é recusado (%j) sem gravar nem avisar',
    async (dto, mensagemErro) => {
      await expect(criar(dto, CLIENTE)).rejects.toThrow(
        new BadRequestException(mensagemErro),
      );
      expect(criarRegistro).not.toHaveBeenCalled();
      expect(enviarEmail).not.toHaveBeenCalled();
    },
  );

  it('usuário do token que não existe mais: 404, nada gravado nem enviado', async () => {
    usuarioFake = null;

    await expect(
      criar({ assunto: 'A', mensagem: 'B' }, CLIENTE),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(criarRegistro).not.toHaveBeenCalled();
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------
  // Aviso aos admins
  // -------------------------------------------------------------------

  it('grava ANTES de avisar e envia um e-mail a cada ADMIN ativo e às caixas contato/suporte, com cliente, data, assunto, mensagem e link', async () => {
    await criar(
      { assunto: 'Troca de aroma', mensagem: 'Linha 1\nLinha 2' },
      CLIENTE,
    );

    expect(criarRegistro.mock.invocationCallOrder[0]).toBeLessThan(
      enviarEmail.mock.invocationCallOrder[0],
    );
    expect(buscarAdmins).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { perfil: PerfilUsuario.ADMIN, ativo: true },
      }),
    );
    expect(enviados().map((e) => e.to)).toEqual([
      ADMIN_1.email,
      ADMIN_2.email,
      CONTATO,
      SUPORTE,
    ]);
    // Todos recebem a mesma mensagem.
    expect(new Set(enviados().map((e) => e.subject)).size).toBe(1);
    expect(new Set(enviados().map((e) => e.html)).size).toBe(1);

    const { subject, html } = enviados()[0];
    expect(subject).toBe(
      'Nova solicitação de suporte (Pedido e entrega) — Troca de aroma',
    );
    expect(html).toContain('Cliente: Ana Souza (ana@sensora.dev)');
    expect(html).toContain('Data: 13/10/2026, 12:00');
    expect(html).toContain('Categoria: Pedido e entrega');
    expect(html).toContain('Assunto: Troca de aroma');
    expect(html).toContain('Mensagem:<br>Linha 1<br>Linha 2');
    expect(html).toContain(
      'href="https://sensorahome.com.br/workspace-x/suporte/1"',
    );

    // Registro de que o aviso foi disparado, sem nenhum dado do cliente.
    expect(infoLog).toHaveBeenCalledWith(
      'Aviso da solicitação de suporte 1 enviado ao provedor para 4 destinatário(s) (2 administrador(es) ativo(s) e os endereços fixos).',
    );
    const logs = JSON.stringify([
      infoLog.mock.calls,
      avisoLog.mock.calls,
      erroLog.mock.calls,
    ]);
    expect(logs).not.toContain('@');
    expect(logs).not.toContain('Troca de aroma');
  });

  it('texto do cliente (nome, assunto e mensagem) é escapado no HTML', async () => {
    usuarioFake = { nome: '<b>Ana</b>', email: 'ana@sensora.dev' };

    await criar(
      {
        assunto: '<script>alert("x")</script>',
        mensagem: '<img src=x onerror=alert(1)>',
      },
      CLIENTE,
    );

    const { html } = enviados()[0];
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b>Ana</b>');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
  });

  it('falha no envio a um admin não impede o envio aos outros', async () => {
    enviarEmail.mockRejectedValueOnce(new Error('provedor fora do ar'));

    await criar({ assunto: 'A', mensagem: 'B' }, CLIENTE);

    expect(enviados().map((e) => e.to)).toEqual([
      ADMIN_1.email,
      ADMIN_2.email,
      CONTATO,
      SUPORTE,
    ]);
    expect(erroLog).toHaveBeenCalledWith(
      'Falha ao avisar o admin 1 sobre a solicitação de suporte 1.',
      expect.any(String),
    );
  });

  it('falha no envio a um endereço fixo não impede o envio ao seguinte (log sem o endereço)', async () => {
    enviarEmail
      .mockResolvedValueOnce(undefined) // admin 1
      .mockResolvedValueOnce(undefined) // admin 2
      .mockRejectedValueOnce(new Error('provedor fora do ar')); // contato

    await criar({ assunto: 'A', mensagem: 'B' }, CLIENTE);

    expect(enviados().map((e) => e.to)).toContain(SUPORTE);
    expect(erroLog).toHaveBeenCalledWith(
      'Falha ao avisar o endereço fixo 1 sobre a solicitação de suporte 1.',
      expect.any(String),
    );
    expect(JSON.stringify(erroLog.mock.calls)).not.toContain('@');
  });

  it('endereço fixo que também é de um ADMIN ativo (maiúsculas diferentes) recebe uma cópia só', async () => {
    admins = [ADMIN_1, { id: 3, email: 'Suporte@SensoraHome.com.br' }];

    await criar({ assunto: 'A', mensagem: 'B' }, CLIENTE);

    expect(enviados().map((e) => e.to)).toEqual([
      ADMIN_1.email,
      'Suporte@SensoraHome.com.br',
      CONTATO,
    ]);
  });

  it('falha no aviso (e-mail ou leitura dos admins) não desfaz a solicitação nem vira erro para o cliente', async () => {
    enviarEmail.mockRejectedValue(new Error('provedor fora do ar'));
    const primeira = await criar({ assunto: 'A', mensagem: 'B' }, CLIENTE);
    // Todas as 4 tentativas falharam e a solicitação continua gravada.
    expect(enviarEmail).toHaveBeenCalledTimes(4);

    buscarAdmins.mockRejectedValueOnce(new Error('banco instável'));
    const segunda = await criar({ assunto: 'C', mensagem: 'D' }, CLIENTE);

    expect(primeira.id).toBe(1);
    expect(segunda.id).toBe(2);
    expect(banco.map((s) => s.id)).toEqual([1, 2]);
    expect(erroLog).toHaveBeenCalledWith(
      'Falha ao avisar os admins sobre a solicitação de suporte 2.',
      expect.any(String),
    );
  });

  it('sem ADMIN ativo: registra aviso no log e as caixas contato/suporte recebem mesmo assim', async () => {
    admins = [];

    await criar({ assunto: 'A', mensagem: 'B' }, CLIENTE);

    expect(enviados().map((e) => e.to)).toEqual([CONTATO, SUPORTE]);
    expect(avisoLog).toHaveBeenCalledWith(
      'Nenhum administrador ativo — aviso da solicitação de suporte 1 vai só para os endereços fixos.',
    );
  });

  it('sem FRONTEND_URL, o e-mail orienta a abrir o painel e não inventa link', async () => {
    frontendUrl = undefined;

    await criar({ assunto: 'A', mensagem: 'B' }, CLIENTE);

    const { html } = enviados()[0];
    expect(html).not.toContain('href=');
    expect(html).toContain('Acesse o painel administrativo, em Suporte');
  });

  // -------------------------------------------------------------------
  // Repetição acidental
  // -------------------------------------------------------------------

  it('repetição idêntica (só espaços diferentes) dentro da janela devolve a mesma, sem gravar nem avisar de novo', async () => {
    const primeira = await criar(
      { assunto: 'Pedido atrasado', mensagem: 'Não chegou.' },
      CLIENTE,
    );
    enviarEmail.mockClear();

    const repetida = await criar(
      { assunto: ' Pedido  atrasado ', mensagem: 'Não chegou. ' },
      CLIENTE,
    );

    expect(repetida.id).toBe(primeira.id);
    expect(criarRegistro).toHaveBeenCalledTimes(1);
    expect(enviarEmail).not.toHaveBeenCalled();
  });

  it('solicitação diferente dentro da janela é criada e avisa de novo', async () => {
    await criar(
      { assunto: 'Pedido atrasado', mensagem: 'Não chegou.' },
      CLIENTE,
    );
    enviarEmail.mockClear();

    const outra = await criar(
      {
        assunto: 'Pedido atrasado',
        mensagem: 'E também quero trocar o aroma.',
      },
      CLIENTE,
    );

    expect(outra.id).toBe(2);
    expect(enviarEmail).toHaveBeenCalledTimes(4);
  });

  it('a mesma solicitação fora da janela é criada normalmente', async () => {
    await criar({ assunto: 'A', mensagem: 'B' }, CLIENTE);
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(AGORA.getTime() + JANELA_REPETICAO_SUPORTE_MS + 1);

    const nova = await criar({ assunto: 'A', mensagem: 'B' }, CLIENTE);

    expect(nova.id).toBe(2);
  });

  it('mesmo assunto e mensagem com outra categoria é outra solicitação', async () => {
    await criar(
      { categoria: CategoriaSuporte.PAGAMENTO, assunto: 'A', mensagem: 'B' },
      CLIENTE,
    );

    const nova = await criar(
      {
        categoria: CategoriaSuporte.PEDIDO_ENTREGA,
        assunto: 'A',
        mensagem: 'B',
      },
      CLIENTE,
    );

    expect(nova.id).toBe(2);
    expect(banco.map((s) => s.categoria)).toEqual([
      CategoriaSuporte.PAGAMENTO,
      CategoriaSuporte.PEDIDO_ENTREGA,
    ]);
  });

  it('a mesma solicitação já em atendimento não é reaproveitada', async () => {
    await criar({ assunto: 'A', mensagem: 'B' }, CLIENTE);
    banco[0].status = StatusSolicitacaoSuporte.EM_ATENDIMENTO;

    const nova = await criar({ assunto: 'A', mensagem: 'B' }, CLIENTE);

    expect(nova.id).toBe(2);
  });

  // -------------------------------------------------------------------
  // Administração
  // -------------------------------------------------------------------

  function semear(
    quantidade: number,
    status = StatusSolicitacaoSuporte.ABERTA,
    categoria = CategoriaSuporte.OUTRO,
  ) {
    for (let i = 0; i < quantidade; i++) {
      const id = banco.length + 1;
      banco.push({
        id,
        usuarioId: CLIENTE.id,
        nome: 'Ana Souza',
        email: 'ana@sensora.dev',
        categoria,
        assunto: `Assunto ${id}`,
        mensagem: `Mensagem ${id}`,
        status,
        criadaEm: AGORA,
        atualizadaEm: AGORA,
      });
    }
  }

  it('lista paginada (total/totalPages), sem a mensagem no resumo', async () => {
    semear(3);

    const pagina = await service.listarParaAdmin({ page: 2, pageSize: 2 });

    expect(pagina).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });
    expect(pagina.items).toHaveLength(1);
    expect(pagina.items[0]).not.toHaveProperty('mensagem');
    expect(pagina.items[0]).toEqual({
      id: 3,
      nome: 'Ana Souza',
      email: 'ana@sensora.dev',
      categoria: CategoriaSuporte.OUTRO,
      assunto: 'Assunto 3',
      status: StatusSolicitacaoSuporte.ABERTA,
      criadaEm: AGORA,
      atualizadaEm: AGORA,
    });
  });

  it('filtra por status (na lista e na contagem) e ordena por criadaEm/id desc', async () => {
    semear(2);
    semear(1, StatusSolicitacaoSuporte.RESOLVIDA);
    const findMany = (
      service as unknown as {
        prisma: { solicitacaoSuporte: { findMany: jest.Mock } };
      }
    ).prisma.solicitacaoSuporte.findMany;

    const pagina = await service.listarParaAdmin({
      page: 1,
      pageSize: 20,
      status: StatusSolicitacaoSuporte.RESOLVIDA,
    });

    expect(pagina.total).toBe(1);
    expect(pagina.items.map((s) => s.id)).toEqual([3]);
    expect(findMany).toHaveBeenLastCalledWith({
      where: { status: StatusSolicitacaoSuporte.RESOLVIDA },
      orderBy: [{ criadaEm: 'desc' }, { id: 'desc' }],
      skip: 0,
      take: 20,
    });
  });

  it('filtra por categoria (combinável com status) e o resumo traz a categoria', async () => {
    semear(1, StatusSolicitacaoSuporte.ABERTA, CategoriaSuporte.PAGAMENTO);
    semear(1, StatusSolicitacaoSuporte.RESOLVIDA, CategoriaSuporte.PAGAMENTO);
    semear(1, StatusSolicitacaoSuporte.ABERTA, CategoriaSuporte.PRODUTO);
    const findMany = (
      service as unknown as {
        prisma: { solicitacaoSuporte: { findMany: jest.Mock } };
      }
    ).prisma.solicitacaoSuporte.findMany;

    const pagina = await service.listarParaAdmin({
      page: 1,
      pageSize: 20,
      categoria: CategoriaSuporte.PAGAMENTO,
    });
    expect(pagina.items.map((s) => s.categoria)).toEqual([
      CategoriaSuporte.PAGAMENTO,
      CategoriaSuporte.PAGAMENTO,
    ]);

    await service.listarParaAdmin({
      page: 1,
      pageSize: 20,
      status: StatusSolicitacaoSuporte.ABERTA,
      categoria: CategoriaSuporte.PAGAMENTO,
    });
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          status: StatusSolicitacaoSuporte.ABERTA,
          categoria: CategoriaSuporte.PAGAMENTO,
        },
      }),
    );
  });

  it('detalhe traz a mensagem; id inexistente é 404', async () => {
    semear(1);

    await expect(service.buscarParaAdmin(1)).resolves.toMatchObject({
      id: 1,
      usuarioId: CLIENTE.id,
      mensagem: 'Mensagem 1',
    });
    await expect(service.buscarParaAdmin(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('muda o status e devolve o detalhe atualizado', async () => {
    semear(1);

    const resultado = await service.atualizarStatus(1, {
      status: StatusSolicitacaoSuporte.EM_ATENDIMENTO,
    });

    expect(atualizarRegistro).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: StatusSolicitacaoSuporte.EM_ATENDIMENTO },
    });
    expect(resultado.status).toBe(StatusSolicitacaoSuporte.EM_ATENDIMENTO);
  });

  it('resolvida pode voltar a EM_ATENDIMENTO (cliente respondeu o e-mail)', async () => {
    semear(1, StatusSolicitacaoSuporte.RESOLVIDA);

    const resultado = await service.atualizarStatus(1, {
      status: StatusSolicitacaoSuporte.EM_ATENDIMENTO,
    });

    expect(resultado.status).toBe(StatusSolicitacaoSuporte.EM_ATENDIMENTO);
  });

  it('mesmo status: nada é gravado e atualizadaEm fica como está', async () => {
    semear(1, StatusSolicitacaoSuporte.RESOLVIDA);

    const resultado = await service.atualizarStatus(1, {
      status: StatusSolicitacaoSuporte.RESOLVIDA,
    });

    expect(atualizarRegistro).not.toHaveBeenCalled();
    expect(resultado.atualizadaEm).toEqual(AGORA);
  });

  it('mudar status de id inexistente é 404, sem gravar', async () => {
    await expect(
      service.atualizarStatus(99, {
        status: StatusSolicitacaoSuporte.RESOLVIDA,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(atualizarRegistro).not.toHaveBeenCalled();
  });
});
