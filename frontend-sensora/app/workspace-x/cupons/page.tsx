"use client";

import { useEffect, useState } from "react";
import { CupomForm, ListaCupons, montarPayload } from "@/components/admin/CuponsPainel";
import FormButton from "@/components/ui/FormButton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import { useToast } from "@/context/ToastContext";
import { revalidarCupons } from "@/lib/actions";
import { getErrorMessage } from "@/lib/errors";
import type { Cupom, SalvarCupomPayload } from "@/lib/types/loja";
import {
  atualizarCupom,
  criarCupom,
  listarCupons,
  removerCupom,
} from "@/services/cupons";

export default function CuponsPage() {
  const toast = useToast();
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Cupom | undefined>(undefined);
  const [formularioAberto, setFormularioAberto] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      setCupons(await listarCupons());
    } catch (err) {
      const mensagem = getErrorMessage(err, "Não foi possível carregar os cupons.");
      toast.error(mensagem);
      setErro(mensagem);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function fechar() {
    setFormularioAberto(false);
    setEditando(undefined);
  }

  async function salvar(payload: SalvarCupomPayload) {
    const editandoAgora = Boolean(editando);
    if (editando) {
      await atualizarCupom(editando.id, payload);
    } else {
      await criarCupom(payload);
    }
    toast.success(editandoAgora ? "Cupom atualizado." : "Cupom criado.");
    fechar();
    await Promise.all([carregar(), revalidarCupons()]);
  }

  async function alternar(cupom: Cupom) {
    try {
      await atualizarCupom(cupom.id, {
        ...montarPayload({
          codigo: cupom.codigo,
          mensagem: cupom.mensagem,
          tipoDesconto: cupom.tipoDesconto,
          valor: String(cupom.valor),
          publico: cupom.publico,
          ativo: !cupom.ativo,
          mostrarNoTopo: cupom.mostrarNoTopo,
          valorMinimo: cupom.valorMinimo != null ? String(cupom.valorMinimo) : "",
          limiteUsos: cupom.limiteUsos != null ? String(cupom.limiteUsos) : "",
          inicioEm: "",
          fimEm: "",
          usuarios: cupom.usuarios,
        }),
        ativo: !cupom.ativo,
        inicioEm: cupom.inicioEm,
        fimEm: cupom.fimEm,
      });
      toast.success(cupom.ativo ? "Cupom pausado." : "Cupom ativado.");
      await Promise.all([carregar(), revalidarCupons()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível atualizar o cupom."));
    }
  }

  async function excluir(cupom: Cupom) {
    if (!window.confirm(`Excluir o cupom ${cupom.codigo}?`)) return;
    try {
      await removerCupom(cupom.id);
      toast.success("Cupom excluído.");
      await Promise.all([carregar(), revalidarCupons()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível excluir o cupom."));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-brand-navy">Cupons</h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Crie um código de desconto e escolha quem pode usar. Com a faixa
            ligada, o texto aparece acima do menu da loja.
          </p>
        </div>
        {!formularioAberto && (
          <FormButton
            variant="primary"
            onClick={() => {
              setEditando(undefined);
              setFormularioAberto(true);
            }}
          >
            Novo cupom
          </FormButton>
        )}
      </div>

      {erro && <InlineErrorState message={erro} onRetry={carregar} />}

      {formularioAberto ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-6 text-lg font-semibold text-brand-navy">
            {editando ? `Editar ${editando.codigo}` : "Novo cupom"}
          </h3>
          <CupomForm
            cupom={editando}
            onSubmit={salvar}
            onCancel={fechar}
          />
        </div>
      ) : loading ? (
        <p className="text-sm text-slate-500">Carregando cupons…</p>
      ) : (
        <ListaCupons
          cupons={cupons}
          onEdit={(cupom) => {
            setEditando(cupom);
            setFormularioAberto(true);
          }}
          onToggle={alternar}
          onRemove={excluir}
        />
      )}
    </div>
  );
}
