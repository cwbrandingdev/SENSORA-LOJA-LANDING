import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { CriarPropostaEmpresaDto } from './dto/criar-proposta-empresa.dto';
import { PropostasEmpresasService } from './propostas-empresas.service';

const DTO: CriarPropostaEmpresaDto = {
  nome: '  Ana Souza ',
  email: 'ana@empresa.com.br',
  telefone: '(41) 99999-0000',
  empresa: ' Empresa X ',
  cargo: 'Marketing / Comunicação',
  objetivo: 'Presente para colaboradores',
  quantidade: '100 a 299 unidades',
  mensagem: '  ',
};

function montar() {
  const prisma = {
    propostaEmpresa: {
      create: jest.fn(({ data }: { data: object }) => ({ id: 1, ...data })),
    },
    usuario: {
      findMany: jest.fn(() => [
        { email: 'Admin@Sensora.dev' },
        { email: 'contato@sensorahome.com.br' },
      ]),
    },
  };
  const mail = { enviarEmail: jest.fn() };
  const service = new PropostasEmpresasService(
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
    { get: () => 'https://www.sensorahome.com.br' } as unknown as ConfigService,
  );
  return { service, prisma, mail };
}

describe('PropostasEmpresasService.criar', () => {
  it('grava com texto limpo e telefone só com dígitos, e avisa cada endereço uma vez', async () => {
    const { service, prisma, mail } = montar();

    await expect(service.criar(DTO)).resolves.toEqual({ recebida: true });

    expect(prisma.propostaEmpresa.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nome: 'Ana Souza',
        empresa: 'Empresa X',
        telefone: '41999990000',
        mensagem: null,
      }),
    });
    // admin + contato@ (que já estava entre os admins): 2 e-mails, sem repetir.
    expect(mail.enviarEmail).toHaveBeenCalledTimes(2);
  });

  it('campo escondido preenchido (robô): responde igual e não grava nem envia', async () => {
    const { service, prisma, mail } = montar();

    await expect(service.criar({ ...DTO, site: 'spam' })).resolves.toEqual({
      recebida: true,
    });
    expect(prisma.propostaEmpresa.create).not.toHaveBeenCalled();
    expect(mail.enviarEmail).not.toHaveBeenCalled();
  });

  it('telefone sem DDD é recusado', async () => {
    const { service } = montar();
    await expect(
      service.criar({ ...DTO, telefone: '9999-0000' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
