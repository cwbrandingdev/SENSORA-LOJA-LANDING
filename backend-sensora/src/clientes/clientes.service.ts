import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Cliente as ClientePrisma } from '../../generated/prisma/client';
import { cpfValido, normalizarCpf } from '../common/utils/cpf.util';
import { normalizarTelefone, telefoneValido } from '../common/utils/telefone.util';
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
      data: {
        ...createClienteDto,
        cpf: this.validarCpf(createClienteDto.cpf),
        telefone: this.validarTelefone(createClienteDto.telefone),
      },
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
      data: {
        ...updateClienteDto,
        ...(updateClienteDto.cpf !== undefined && {
          cpf: this.validarCpf(updateClienteDto.cpf),
        }),
        ...(updateClienteDto.telefone !== undefined && {
          telefone: this.validarTelefone(updateClienteDto.telefone),
        }),
      },
    });
    return this.paraCliente(cliente);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.prisma.cliente.delete({ where: { id } });
  }

  // Etapa 8.10 (hardening LOW — achado da auditoria): Cliente é o módulo
  // legado, desconectado do fluxo real de pedidos da loja (que usa
  // Usuario.cpf/telefone, já validados) — antes destas duas funções,
  // create()/update() aqui aceitavam qualquer string não-vazia como CPF ou
  // telefone. Reaproveita exatamente os mesmos utilitários já testados que
  // UsuariosService usa (cpf.util/telefone.util), mesma mensagem de erro,
  // sem duplicar a lógica de validação nem inventar uma regra nova.
  private validarCpf(cpf: string): string {
    if (!cpfValido(cpf)) {
      throw new BadRequestException('CPF inválido.');
    }
    return normalizarCpf(cpf);
  }

  private validarTelefone(telefone: string): string {
    if (!telefoneValido(telefone)) {
      throw new BadRequestException('Telefone inválido.');
    }
    return normalizarTelefone(telefone);
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
