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

  async create(usuarioId: number, dto: CreateEnderecoDto): Promise<Endereco> {
    const endereco = await this.prisma.endereco.create({
      data: { ...dto, usuarioId },
    });
    return this.paraEndereco(endereco);
  }

  async update(
    id: number,
    usuarioId: number,
    dto: UpdateEnderecoDto,
  ): Promise<Endereco> {
    await this.findOneForUsuario(id, usuarioId);
    const endereco = await this.prisma.endereco.update({
      where: { id },
      data: dto,
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
