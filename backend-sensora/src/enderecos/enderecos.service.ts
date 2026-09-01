import { Injectable, NotFoundException } from '@nestjs/common';
import type { Endereco as EnderecoPrisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnderecoDto } from './dto/create-endereco.dto';
import { UpdateEnderecoDto } from './dto/update-endereco.dto';
import { Endereco } from './entities/endereco.entity';

@Injectable()
export class EnderecosService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUsuario(usuarioId: number): Promise<Endereco[]> {
    const enderecos = await this.prisma.endereco.findMany({
      where: { usuarioId },
      orderBy: [{ padrao: 'desc' }, { id: 'desc' }],
    });
    return enderecos.map((endereco) => this.paraEndereco(endereco));
  }

  // Sempre filtra por id + usuarioId juntos — nunca só por id — para que um
  // usuário autenticado não consiga ler/alterar/remover o endereço de outro
  // só adivinhando o id (ver EnderecosController, que sempre passa o id do
  // token, nunca de input do cliente).
  async findOneForUsuario(id: number, usuarioId: number): Promise<Endereco> {
    const endereco = await this.prisma.endereco.findFirst({
      where: { id, usuarioId },
    });
    if (!endereco) {
      throw new NotFoundException(`Endereço com id ${id} não encontrado`);
    }
    return this.paraEndereco(endereco);
  }

  // Achado da auditoria (Etapa 4): nada garantia que só um endereço por
  // usuário ficasse com padrao:true — create()/update() antigos só
  // repassavam o campo direto pro Prisma. Primeiro endereço do usuário vira
  // padrão automaticamente (não há o que desmarcar ainda); um padrao:true
  // explícito com outros endereços já existentes desmarca os demais dentro
  // da mesma transação, garantindo no máximo um padrão por usuário sempre.
  async create(usuarioId: number, dto: CreateEnderecoDto): Promise<Endereco> {
    const totalExistente = await this.prisma.endereco.count({
      where: { usuarioId },
    });
    const devePadrao = dto.padrao === true || totalExistente === 0;

    const endereco = await this.prisma.$transaction(async (tx) => {
      const criado = await tx.endereco.create({
        data: { ...dto, usuarioId, padrao: devePadrao },
      });
      if (devePadrao) {
        await tx.endereco.updateMany({
          where: { usuarioId, id: { not: criado.id } },
          data: { padrao: false },
        });
      }
      return criado;
    });

    return this.paraEndereco(endereco);
  }

  async update(
    id: number,
    usuarioId: number,
    dto: UpdateEnderecoDto,
  ): Promise<Endereco> {
    await this.findOneForUsuario(id, usuarioId);

    const endereco = await this.prisma.$transaction(async (tx) => {
      if (dto.padrao === true) {
        await tx.endereco.updateMany({
          where: { usuarioId, id: { not: id } },
          data: { padrao: false },
        });
      }
      return tx.endereco.update({ where: { id }, data: dto });
    });

    return this.paraEndereco(endereco);
  }

  async remove(id: number, usuarioId: number): Promise<void> {
    await this.findOneForUsuario(id, usuarioId);
    await this.prisma.endereco.delete({ where: { id } });
  }

  private paraEndereco(endereco: EnderecoPrisma): Endereco {
    return {
      id: endereco.id,
      usuarioId: endereco.usuarioId,
      rua: endereco.rua,
      numero: endereco.numero,
      complemento: endereco.complemento ?? undefined,
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      estado: endereco.estado,
      cep: endereco.cep,
      padrao: endereco.padrao,
    };
  }
}
