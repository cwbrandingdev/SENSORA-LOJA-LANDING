"use client";

// Portado de frontend/components/forms/ProductForm.js — mesmo schema,
// mesmo comportamento. Só tipado. Campos categoriaId/imagemUrl/destaque/ativo
// foram adicionados nesta etapa (ver auditoria do Admin) — o contrato
// CreateProdutoPayload/Produto já suportava todos eles, só faltava o form.
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import FormButton from "@/components/ui/FormButton";
import ImageUploader from "@/components/forms/ImageUploader";
import type { Categoria, Produto } from "@/lib/types/loja";

const productSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional(),
  preco: z.coerce
    .number({ error: "Preço é obrigatório" })
    .positive("Preço deve ser maior que zero"),
  quantidade: z.coerce
    .number({ error: "Quantidade é obrigatória" })
    .int("Quantidade deve ser um número inteiro")
    .min(0, "Quantidade não pode ser negativa"),
  // Valor cru do <select> (string do id, ou "" para "Sem categoria") — a
  // conversão para number|undefined do CreateProdutoPayload acontece em
  // app/workspace-x/produtos/page.tsx, não aqui (o form não conhece o payload).
  categoriaId: z.string().optional(),
  imagemUrl: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^(https?:\/\/|\/)/.test(val), {
      message: "Informe uma URL válida (http(s) ou caminho começando com /)",
    }),
  destaque: z.boolean(),
  ativo: z.boolean(),
});

type ProductFormInput = z.input<typeof productSchema>;
export type ProductFormValues = z.output<typeof productSchema>;

function toDefaultValues(produto?: Produto): ProductFormInput {
  return {
    nome: produto?.nome ?? "",
    descricao: produto?.descricao ?? "",
    preco: produto?.preco ?? "",
    quantidade: produto?.quantidade ?? ("" as unknown as number),
    categoriaId: produto?.categoriaId != null ? String(produto.categoriaId) : "",
    imagemUrl: produto?.imagemUrl ?? "",
    destaque: produto?.destaque ?? false,
    ativo: produto?.ativo ?? true,
  };
}

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";
const errorClass = "text-sm text-red-600";
const checkboxClass =
  "h-4 w-4 rounded border-slate-300 text-brand-navy focus:ring-1 focus:ring-brand-navy";

type ProductFormProps = {
  initialData?: Produto;
  /** Categorias reais da API (listarCategorias) para popular o select —
   *  o form nunca cria categoria, só escolhe entre as já existentes. */
  categorias: Categoria[];
  onSubmit: (data: ProductFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

export default function ProductForm({
  initialData,
  categorias,
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: toDefaultValues(initialData),
  });

  useEffect(() => {
    reset(toDefaultValues(initialData));
  }, [initialData, reset]);

  const imagemUrl = watch("imagemUrl");
  const nome = watch("nome");

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="nome" className={labelClass}>
          Nome
        </label>
        <input id="nome" type="text" className={inputClass} {...register("nome")} />
        {errors.nome && <p className={errorClass}>{errors.nome.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="descricao" className={labelClass}>
          Descrição
        </label>
        <input
          id="descricao"
          type="text"
          className={inputClass}
          {...register("descricao")}
        />
        {errors.descricao && (
          <p className={errorClass}>{errors.descricao.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="preco" className={labelClass}>
          Preço
        </label>
        <input
          id="preco"
          type="number"
          step="0.01"
          className={inputClass}
          {...register("preco")}
        />
        {errors.preco && <p className={errorClass}>{errors.preco.message}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="quantidade" className={labelClass}>
          Quantidade (estoque)
        </label>
        <input
          id="quantidade"
          type="number"
          className={inputClass}
          {...register("quantidade")}
        />
        {errors.quantidade && (
          <p className={errorClass}>{errors.quantidade.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="categoriaId" className={labelClass}>
          Categoria
        </label>
        <select id="categoriaId" className={inputClass} {...register("categoriaId")}>
          <option value="">Sem categoria</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
        {errors.categoriaId && (
          <p className={errorClass}>{errors.categoriaId.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelClass}>Imagem do produto</label>
        <ImageUploader
          key={initialData?.id ?? "new"}
          value={imagemUrl}
          onChange={(url) => setValue("imagemUrl", url, { shouldValidate: true, shouldDirty: true })}
          nomeProduto={nome}
        />
        {errors.imagemUrl && (
          <p className={errorClass}>{errors.imagemUrl.message}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input id="destaque" type="checkbox" className={checkboxClass} {...register("destaque")} />
        <label htmlFor="destaque" className={labelClass}>
          Produto em destaque
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input id="ativo" type="checkbox" className={checkboxClass} {...register("ativo")} />
        <label htmlFor="ativo" className={labelClass}>
          Produto ativo
        </label>
      </div>

      <div className="flex gap-2">
        <FormButton type="submit" variant="primary" disabled={isSubmitting}>
          {initialData ? "Salvar edição" : "Criar produto"}
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
