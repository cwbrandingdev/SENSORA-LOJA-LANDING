"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Tags,
  Users as UsersIcon,
  ShoppingCart,
  UserCog,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listarProdutos } from "@/services/produtos";
import { listarCategorias } from "@/services/categorias";
import { listarClientes } from "@/services/clientes";
import { listarPedidos } from "@/services/pedidos";
import { listarUsuarios } from "@/services/usuarios";
import { ROUTES } from "@/lib/routes";
import KpiCard, { KpiCardSkeleton } from "@/components/dashboard/KpiCard";
import { PedidoStatusBadge } from "@/components/tables/PedidoTable";
import Skeleton from "@/components/ui/Skeleton";
import type { Produto, Categoria, Cliente, Pedido, Usuario } from "@/lib/types";

const STATUS_ORDER = ["PENDENTE", "PAGO", "CANCELADO"] as const;

export default function AdminDashboardPage() {
  const { perfil } = useAuth();
  const isAdmin = perfil === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [categorias, setCategorias] = useState<Categoria[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[] | null>(null);

  async function carregarDashboard() {
    setLoading(true);

    const [produtosR, categoriasR, clientesR, pedidosR, usuariosR] =
      await Promise.allSettled([
        listarProdutos(),
        listarCategorias(),
        listarClientes(),
        listarPedidos(),
        isAdmin ? listarUsuarios() : Promise.resolve(null),
      ]);

    setProdutos(produtosR.status === "fulfilled" ? produtosR.value : null);
    setCategorias(categoriasR.status === "fulfilled" ? categoriasR.value : null);
    setClientes(clientesR.status === "fulfilled" ? clientesR.value : null);
    setPedidos(pedidosR.status === "fulfilled" ? pedidosR.value : null);
    setUsuarios(
      isAdmin && usuariosR.status === "fulfilled" ? usuariosR.value : null,
    );
    setLoading(false);
  }

  useEffect(() => {
    carregarDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const semEstoque = produtos
    ? produtos.filter((p) => p.quantidade <= 0).length
    : 0;
  const usuariosInativos = usuarios
    ? usuarios.filter((u) => !u.ativo).length
    : 0;
  const statusCounts = pedidos
    ? STATUS_ORDER.reduce<Record<string, number>>((acc, status) => {
        acc[status] = pedidos.filter((p) => p.status === status).length;
        return acc;
      }, {})
    : null;

  const quickActions = [
    { label: "Novo produto", href: ROUTES.PRODUTOS, icon: Package },
    { label: "Nova categoria", href: ROUTES.CATEGORIAS, icon: Tags },
    { label: "Novo cliente", href: ROUTES.CLIENTES, icon: UsersIcon },
    { label: "Novo pedido", href: ROUTES.PEDIDOS, icon: ShoppingCart },
    ...(isAdmin
      ? [{ label: "Gerenciar usuários", href: ROUTES.USUARIOS, icon: UserCog }]
      : []),
  ];

  return (
    <div className="motion-safe:animate-[fade-in-up_250ms_ease-out] flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-brand-navy">Dashboard</h2>
        <p className="text-sm text-slate-500">
          Visão geral da loja Sensora — dados atuais de produtos, clientes e
          pedidos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: isAdmin ? 5 : 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))
        ) : (
          <>
            <KpiCard
              icon={Package}
              label="Produtos"
              value={produtos ? produtos.length : "—"}
              hint={semEstoque > 0 ? `${semEstoque} sem estoque` : ""}
              href={ROUTES.PRODUTOS}
            />
            <KpiCard
              icon={Tags}
              label="Categorias"
              value={categorias ? categorias.length : "—"}
              hint=""
              href={ROUTES.CATEGORIAS}
            />
            <KpiCard
              icon={UsersIcon}
              label="Clientes"
              value={clientes ? clientes.length : "—"}
              hint=""
              href={ROUTES.CLIENTES}
            />
            <KpiCard
              icon={ShoppingCart}
              label="Pedidos"
              value={pedidos ? pedidos.length : "—"}
              hint={
                statusCounts && statusCounts.PENDENTE > 0
                  ? `${statusCounts.PENDENTE} pendente(s)`
                  : ""
              }
              href={ROUTES.PEDIDOS}
            />
            {isAdmin && (
              <KpiCard
                icon={UserCog}
                label="Usuários"
                value={usuarios ? usuarios.length : "—"}
                hint={
                  usuariosInativos > 0 ? `${usuariosInativos} inativo(s)` : ""
                }
                href={ROUTES.USUARIOS}
              />
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700">
            Pedidos por status
          </h3>

          {loading ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {STATUS_ORDER.map((status) => (
                <Skeleton key={status} className="h-11 w-full rounded-md" />
              ))}
            </div>
          ) : statusCounts ? (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {STATUS_ORDER.map((status) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5"
                >
                  <PedidoStatusBadge status={status} />
                  <span className="text-lg font-semibold text-slate-900">
                    {statusCounts[status]}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              Não foi possível carregar o resumo de pedidos.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700">
            Ações rápidas
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-brand-navy hover:bg-brand-navy hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30"
              >
                <action.icon size={16} />
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
