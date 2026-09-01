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
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormButton from "@/components/ui/FormButton";
import type { Endereco } from "@/lib/types/loja";

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
    formState: { errors, isSubmitting },
  } = useForm<EnderecoFormValues>({
    resolver: zodResolver(enderecoSchema),
    defaultValues: toDefaultValues(initialData),
  });

  useEffect(() => {
    reset(toDefaultValues(initialData));
  }, [initialData, reset]);

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
