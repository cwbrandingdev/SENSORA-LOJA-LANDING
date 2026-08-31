import { Injectable, NotFoundException } from '@nestjs/common';
import type { Cliente as ClientePrisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { Cliente } from './entities/cliente.entity';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Cliente[]> {
    const clientes = await this.prisma.cliente.findMany();
    return clientes.map((cliente) => this.paraCliente(cliente));
  }

  async findOne(id: number): Promise<Cliente> {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) {
      throw new NotFoundException(`Cliente com id ${id} não encontrado`);
    }
    return this.paraCliente(cliente);
  }

  async create(createClienteDto: CreateClienteDto): Promise<Cliente> {
    const cliente = await this.prisma.cliente.create({
      data: createClienteDto,
    });
    return this.paraCliente(cliente);
  }

  async update(
    id: number,
    updateClienteDto: UpdateClienteDto,
  ): Promise<Cliente> {
    await this.findOne(id);
    const cliente = await this.prisma.cliente.update({
      where: { id },
      data: updateClienteDto,
    });
    return this.paraCliente(cliente);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.prisma.cliente.delete({ where: { id } });
  }

  private paraCliente(cliente: ClientePrisma): Cliente {
    return {
      id: cliente.id,
      nome: cliente.nome,
      email: cliente.email,
      telefone: cliente.telefone,
      cpf: cliente.cpf,
      endereco: cliente.endereco,
    };
  }
}
