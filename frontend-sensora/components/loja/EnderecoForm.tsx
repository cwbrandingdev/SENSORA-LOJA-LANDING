"use client";

// Mesmo padrão de components/forms/ClientForm.tsx e demais formulários do
// projeto (react-hook-form + zod + FormButton, mesmas classes de input) —
// só os campos mudam, para bater com CreateEnderecoDto do backend.
//
// Etapa 4 (Minha Conta / Endereços) — acrescentou `initialData` (opcional,
// mesmo padrão de PedidoForm/ItemPedidoForm) para reaproveitar este mesmo
// formulário também na edição em /conta/enderecos, sem duplicar campos/
// validação. Uso existente no checkout (sem initialData) continua
// idêntico — defaultValues cai no mesmo fallback de string vazia de antes.
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormButton from "@/components/ui/FormButton";
import { cepCompleto, normalizarCep } from "@/lib/cep";
import { buscarEnderecoPorCep } from "@/services/via-cep";
import type { Endereco } from "@/lib/types/loja";

// Preenchimento automático via ViaCEP — só dispara quando o CEP muda para
// um valor diferente do que reset()/initialData acabou de carregar (ver
// cepCarregadoPeloResetRef mais abaixo), nunca no carregamento inicial de
// um endereço existente: sem essa guarda, abrir o formulário de edição já
// reconsultaria e sobrescreveria rua/bairro/cidade/estado antes de
// qualquer digitação real do usuário.
const DEBOUNCE_BUSCA_CEP_MS = 400;

type StatusBuscaCep = "ocioso" | "buscando" | "nao-encontrado" | "erro";

const enderecoSchema = z.object({
  rua: z.string().min(1, "Rua é obrigatória").max(200),
  numero: z.string().min(1, "Número é obrigatório").max(20),
  complemento: z.string().max(200).optional(),
  bairro: z.string().min(1, "Bairro é obrigatório").max(100),
  cidade: z.string().min(1, "Cidade é obrigatória").max(100),
  estado: z.string().length(2, "Use a sigla do estado (2 letras)"),
  cep: z
    .string()
    .min(1, "CEP é obrigatório")
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido — use o formato 00000-000"),
});

export type EnderecoFormValues = z.infer<typeof enderecoSchema>;

function toDefaultValues(endereco?: Endereco): EnderecoFormValues {
  return {
    rua: endereco?.rua ?? "",
    numero: endereco?.numero ?? "",
    complemento: endereco?.complemento ?? "",
    bairro: endereco?.bairro ?? "",
    cidade: endereco?.cidade ?? "",
    estado: endereco?.estado ?? "",
    cep: endereco?.cep ?? "",
  };
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";

type EnderecoFormProps = {
  initialData?: Endereco;
  onSubmit: (data: EnderecoFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

export default function EnderecoForm({ initialData, onSubmit, onCancel }: EnderecoFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EnderecoFormValues>({
    resolver: zodResolver(enderecoSchema),
    defaultValues: toDefaultValues(initialData),
  });

  // Guarda o CEP (só dígitos) carregado pelo reset mais recente — é contra
  // esse valor que o efeito de busca abaixo compara o CEP atual, para nunca
  // disparar uma consulta só porque initialData/reset mudou o valor do
  // campo (edição de um endereço existente não deve reconsultar e
  // sobrescrever rua/bairro/cidade/estado antes de qualquer digitação real).
  const cepCarregadoPeloResetRef = useRef(normalizarCep(toDefaultValues(initialData).cep));

  useEffect(() => {
    const valores = toDefaultValues(initialData);
    reset(valores);
    cepCarregadoPeloResetRef.current = normalizarCep(valores.cep);
  }, [initialData, reset]);

  const [statusBuscaCep, setStatusBuscaCep] = useState<StatusBuscaCep>("ocioso");
  // Guarda o último CEP já consultado com sucesso/falha — evita repetir a
  // mesma busca enquanto o valor completo não mudar de verdade.
  const ultimoCepConsultadoRef = useRef<string | null>(null);

  async function buscarCep(cepDigitos: string) {
    if (ultimoCepConsultadoRef.current === cepDigitos) return;
    ultimoCepConsultadoRef.current = cepDigitos;
    setStatusBuscaCep("buscando");
    try {
      const endereco = await buscarEnderecoPorCep(cepDigitos);
      if (!endereco) {
        setStatusBuscaCep("nao-encontrado");
        return;
      }
      // Só rua/bairro/cidade/estado — número e complemento nunca são
      // tocados aqui (continuam exclusivamente manuais, ver requisito).
      setValue("rua", endereco.logradouro, { shouldValidate: true });
      setValue("bairro", endereco.bairro, { shouldValidate: true });
      setValue("cidade", endereco.cidade, { shouldValidate: true });
      setValue("estado", endereco.estado, { shouldValidate: true });
      setStatusBuscaCep("ocioso");
    } catch {
      setStatusBuscaCep("erro");
    }
  }

  // react-hooks/refs (React Compiler) não permite ler `ref.current` num
  // callback criado dentro do JSX renderizado (ex.: `register("cep",
  // {onChange})` inline) — só é seguro em event handlers "de verdade" ou em
  // efeitos. Por isso o gatilho da busca mora aqui, reagindo a `watch("cep")`
  // (estado do próprio react-hook-form, não uma ref nossa) dentro de um
  // efeito, com debounce local via setTimeout/clearTimeout.
  const cepAtual = watch("cep");
  useEffect(() => {
    const cepDigitos = normalizarCep(cepAtual ?? "");

    if (!cepCompleto(cepAtual ?? "")) {
      setStatusBuscaCep("ocioso");
      return;
    }

    // Mesmo valor que reset()/initialData acabou de carregar — não é
    // digitação do usuário, não dispara consulta nenhuma.
    if (cepDigitos === cepCarregadoPeloResetRef.current) {
      return;
    }

    const timer = setTimeout(() => {
      void buscarCep(cepDigitos);
    }, DEBOUNCE_BUSCA_CEP_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepAtual]);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-sm border border-slate-200 bg-white p-4 sm:p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-1">
          <label htmlFor="rua" className={labelClass}>
            Rua
          </label>
          <input id="rua" type="text" className={inputClass} {...register("rua")} />
          {errors.rua && <p className={errorClass}>{errors.rua.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="numero" className={labelClass}>
            Número
          </label>
          <input id="numero" type="text" className={inputClass} {...register("numero")} />
          {errors.numero && <p className={errorClass}>{errors.numero.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="complemento" className={labelClass}>
          Complemento <span className="font-normal text-slate-400">(opcional)</span>
        </label>
        <input id="complemento" type="text" className={inputClass} {...register("complemento")} />
        {errors.complemento && <p className={errorClass}>{errors.complemento.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="bairro" className={labelClass}>
            Bairro
          </label>
          <input id="bairro" type="text" className={inputClass} {...register("bairro")} />
          {errors.bairro && <p className={errorClass}>{errors.bairro.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cidade" className={labelClass}>
            Cidade
          </label>
          <input id="cidade" type="text" className={inputClass} {...register("cidade")} />
          {errors.cidade && <p className={errorClass}>{errors.cidade.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-1">
          <label htmlFor="estado" className={labelClass}>
            Estado (UF)
          </label>
          <input
            id="estado"
            type="text"
            maxLength={2}
            className={`${inputClass} uppercase`}
            {...register("estado")}
          />
          {errors.estado && <p className={errorClass}>{errors.estado.message}</p>}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="cep" className={labelClass}>
            CEP
          </label>
          <input id="cep" type="text" placeholder="00000-000" className={inputClass} {...register("cep")} />
          {errors.cep && <p className={errorClass}>{errors.cep.message}</p>}
          {!errors.cep && statusBuscaCep === "buscando" && (
            <p className="inline-flex items-center gap-2 text-xs text-slate-500">
              <span
                aria-hidden
                className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-navy"
              />
              Buscando endereço...
            </p>
          )}
          {!errors.cep && statusBuscaCep === "nao-encontrado" && (
            <p className="text-xs text-slate-500">
              CEP não encontrado. Preencha o endereço manualmente.
            </p>
          )}
          {!errors.cep && statusBuscaCep === "erro" && (
            <p className="text-xs text-slate-500">
              Não foi possível buscar o endereço automaticamente. Preencha manualmente.
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <FormButton type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : initialData ? "Salvar edição" : "Salvar endereço"}
        </FormButton>

        {onCancel && (
          <FormButton type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </FormButton>
        )}
      </div>
    </form>
  );
}
