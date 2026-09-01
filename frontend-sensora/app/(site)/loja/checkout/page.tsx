"use client";

// Task 7 (guarda de acesso) + Task 8 (endereços) + Task 9 (checkout real:
// layout de duas colunas, resumo do carrinho via CartContext, validação do
// CTA) + Task 10 (chama POST /checkout/session via services/checkout.ts) +
// Task 11 (redireciona para a URL de pagamento hospedada retornada pelo
// backend). Task 21 migrou o gateway de Stripe para Asaas — nenhum SDK de
// pagamento roda aqui em nenhum dos dois casos: o frontend só navega para a
// URL que o backend devolve, depois de validá-la minimamente.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { isAxiosError } from "axios";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import EnderecoCard from "@/components/loja/EnderecoCard";
import EnderecoCardSkeleton from "@/components/loja/EnderecoCardSkeleton";
import EnderecoForm, { type EnderecoFormValues } from "@/components/loja/EnderecoForm";
import CheckoutItemRow from "@/components/loja/CheckoutItemRow";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { loginComRedirect, possuiSessaoValida } from "@/lib/auth-redirect";
import { decodeToken } from "@/lib/jwt";
import { ROUTES } from "@/lib/routes";
import { getToken, setCheckoutPendente } from "@/lib/storage";
import { criarEndereco, listarEnderecos } from "@/services/enderecos";
import { criarSessaoCheckout, isUrlDeCheckoutSegura } from "@/services/checkout";
import type { CheckoutSessionResponse, Endereco } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function CheckoutPage() {
  const router = useRouter();
  const toast = useToast();
  const { itens, totalItens, subtotal } = useCart();

  // `null` = guarda ainda não decidiu (evita flash de conteúdo protegido).
  const [autorizado, setAutorizado] = useState<boolean | null>(null);

  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<number | null>(null);

  // Realce temporário da seção de endereço quando o usuário tenta continuar
  // sem selecionar nenhum — some sozinho, sem exigir outra interação.
  const [destacarEndereco, setDestacarEndereco] = useState(false);
  const enderecoSectionRef = useRef<HTMLDivElement>(null);

  // Task 10/11: true desde o clique até a resposta de POST
  // /checkout/session — evita duplo clique/duplo pedido. Em caso de sucesso
  // permanece `true` deliberadamente (ver handleContinuar): o navegador já
  // está saindo para a página de pagamento, então o botão nunca volta a
  // ficar clicável.
  const [criandoSessao, setCriandoSessao] = useState(false);

  useEffect(() => {
    if (possuiSessaoValida()) {
      setAutorizado(true);
    } else {
      router.replace(loginComRedirect(ROUTES.LOJA_CHECKOUT));
    }
  }, [router]);

  const carregarEnderecos = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const data = await listarEnderecos();
      setEnderecos(data);
      setEnderecoSelecionadoId((atual) => {
        if (atual !== null && data.some((endereco) => endereco.id === atual)) {
          return atual;
        }
        return (data.find((endereco) => endereco.padrao) ?? data[0])?.id ?? null;
      });
    } catch (err) {
      setErro(getErrorMessage(err, "Não foi possível carregar seus endereços."));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (autorizado) {
      carregarEnderecos();
    }
  }, [autorizado, carregarEnderecos]);

  useEffect(() => {
    if (!destacarEndereco) return;
    const timer = window.setTimeout(() => setDestacarEndereco(false), 1800);
    return () => window.clearTimeout(timer);
  }, [destacarEndereco]);

  async function handleCadastrarEndereco(data: EnderecoFormValues) {
    try {
      const novoEndereco = await criarEndereco({ ...data, estado: data.estado.toUpperCase() });
      toast.success("Endereço cadastrado com sucesso.");
      // Atualiza a lista localmente (sem refazer a requisição inteira) e
      // seleciona o endereço recém-criado automaticamente.
      setEnderecos((prev) => [novoEndereco, ...prev]);
      setEnderecoSelecionadoId(novoEndereco.id);
      setMostrarFormulario(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível cadastrar o endereço."));
    }
  }

  // Task 9 validou localmente (sessão + carrinho + endereço). Task 10
  // chama POST /checkout/session. Task 11 usa a `url` da resposta para
  // sair para a página hospedada de pagamento (Asaas Checkout, a partir da
  // Task 21) — sem SDK de pagamento, sem qualquer lógica de pagamento no
  // frontend.
  async function handleContinuar() {
    if (!possuiSessaoValida()) {
      router.replace(loginComRedirect(ROUTES.LOJA_CHECKOUT));
      return;
    }
    if (itens.length === 0 || carregando || criandoSessao) return;

    if (erro || !enderecoSelecionadoId) {
      toast.error(
        erro
          ? "Não foi possível carregar seus endereços. Tente novamente."
          : "Selecione um endereço de entrega para continuar.",
      );
      setDestacarEndereco(true);
      enderecoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // O JWT (Task 3/17 do backend) só carrega sub/email/perfil — não há
    // `nome` nele nem nenhum endpoint self-service que um CLIENTE possa
    // chamar para buscar o próprio nome (GET /usuarios/:id é ADMIN-only,
    // GET /clientes é STAFF-only). Decisão registrada com o usuário: até
    // isso ser resolvido no backend (ex.: incluir `nome` no JWT ou expor
    // /auth/me), deriva um nome provisório da parte local do e-mail —
    // limitação conhecida, não um bug desta task.
    const payload = decodeToken(getToken());
    if (!payload?.email) {
      router.replace(loginComRedirect(ROUTES.LOJA_CHECKOUT));
      return;
    }

    setCriandoSessao(true);

    let sessao: CheckoutSessionResponse;
    try {
      sessao = await criarSessaoCheckout({
        itens: itens.map((item) => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
        })),
        clienteEmail: payload.email,
        clienteNome: payload.email.split("@")[0],
        enderecoId: enderecoSelecionadoId,
      });
    } catch (err) {
      setCriandoSessao(false);

      // Task 16: sessão expirou entre carregar a página e clicar em
      // continuar — o interceptor global (services/api.ts) já está
      // redirecionando para /login?redirect=/loja/checkout neste exato
      // momento (preservando o carrinho, que nunca é tocado aqui). Não
      // mostra toast nem tenta mais nada, pra não competir com essa
      // navegação nem confundir o usuário com uma mensagem genérica.
      if (isAxiosError(err) && err.response?.status === 401) {
        return;
      }

      // Sem resposta nenhuma do backend (timeout, DNS, servidor fora do
      // ar) — não é erro de validação/negócio, então getErrorMessage não
      // tem mensagem do backend pra usar; mensagem específica de rede em
      // vez do fallback genérico de pagamento.
      if (!isAxiosError(err) || !err.response) {
        toast.error("Não foi possível conectar ao servidor. Tente novamente.");
        return;
      }

      const mensagem = getErrorMessage(
        err,
        "Não foi possível iniciar o pagamento. Tente novamente.",
      );

      // Endereço pode ter sido removido (ou deixado de pertencer ao
      // usuário) entre o carregamento da página e o clique — a API não
      // expõe um código de erro dedicado pra esse caso, então a mensagem
      // que o backend já manda (EnderecosService.findOneForUsuario) é o
      // único sinal disponível sem alterar o backend. Recarrega a lista e
      // limpa a seleção "fantasma" em vez de deixar o usuário preso
      // tentando de novo com o mesmo endereço inválido.
      if (mensagem.toLowerCase().includes("endereço")) {
        toast.error("Esse endereço não está mais disponível. Selecione outro.");
        setEnderecoSelecionadoId(null);
        carregarEnderecos();
        setDestacarEndereco(true);
        enderecoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      // Demais erros de validação/negócio (produto indisponível, estoque
      // insuficiente, carrinho vazio) — a mensagem do backend já é
      // específica e segura de mostrar (nunca stack trace: ver
      // AllExceptionsFilter). O link "← Voltar ao carrinho" já visível na
      // coluna ao lado cobre "permitir revisar os itens", sem precisar de
      // nenhuma lógica nova aqui.
      toast.error(mensagem);
      return;
    }

    // Validação mínima antes de navegar: o backend é a fonte da URL, mas o
    // frontend nunca executa window.location numa string arbitrária vinda
    // da resposta (campo ausente, payload malformado, regressão futura no
    // backend). Sem isso, silenciosamente ficaríamos parados no checkout —
    // com isso, o usuário recebe feedback e pode tentar de novo.
    if (!isUrlDeCheckoutSegura(sessao.url)) {
      toast.error("Não foi possível iniciar o pagamento. Tente novamente.");
      setCriandoSessao(false);
      return;
    }

    // Etapa 2 (Minha Conta / limpeza do carrinho) — marca esta sessão como
    // "pendente de confirmação" ANTES de sair para o Asaas: é o único jeito
    // de /checkout/sucesso saber depois qual sessão voltou (o successUrl
    // enviado ao Asaas não carrega nenhum identificador, ver
    // criarSessaoAsaas no backend). Só isto — nenhuma limpeza do carrinho
    // acontece aqui, o carrinho continua intacto até a confirmação real.
    setCheckoutPendente(sessao.sessionId);

    // Sucesso: sai para a página hospedada de pagamento (Asaas Checkout). URL externa —
    // router.push() é para rotas internas do Next, não se aplica aqui.
    // `criandoSessao` deliberadamente NÃO volta a `false`: o navegador já
    // está navegando para fora desta página, e nenhuma outra lógica de
    // checkout deve rodar depois disto.
    window.location.assign(sessao.url);
  }

  if (!autorizado) {
    return (
      <p className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Carregando...
      </p>
    );
  }

  return (
    <>
      <section className="relative mx-auto max-w-3xl overflow-hidden px-6 pt-28 pb-8 text-center sm:pt-36 lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Loja
          </p>
          <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
            Checkout
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Revise o endereço de entrega e os itens da sua sacola antes de
            seguir para o pagamento.
          </p>
        </RevealOnScroll>
      </section>

      {itens.length === 0 ? (
        <div className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40">
          <RevealOnScroll>
            <EmptyState
              eyebrow="Checkout"
              title="Não há produtos para finalizar"
              message="Seu carrinho está vazio. Volte para a loja e escolha os produtos que deseja comprar."
            />
            <div className="flex justify-center">
              <Button href={ROUTES.LOJA_PRODUTOS} variant="primary">
                Voltar para a loja →
              </Button>
            </div>
          </RevealOnScroll>
        </div>
      ) : (
        <section className="mx-auto max-w-6xl px-6 pb-24 sm:pb-32 lg:px-10 lg:pb-40">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
            <RevealOnScroll>
              <div
                ref={enderecoSectionRef}
                className={`rounded-sm transition-shadow duration-500 ${
                  destacarEndereco
                    ? "ring-2 ring-brand-orange ring-offset-4 ring-offset-background"
                    : ""
                }`}
              >
                <div className="border-b border-slate-200 pb-4">
                  <h2 className="font-serif text-xl font-normal text-brand-navy">
                    Endereço de entrega
                  </h2>
                </div>

                <div className="mt-6">
                  {carregando ? (
                    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
                      <EnderecoCardSkeleton />
                      <EnderecoCardSkeleton />
                    </div>
                  ) : erro ? (
                    <div className="flex flex-col items-center gap-4 rounded-sm border border-red-200 bg-red-50 px-6 py-10 text-center">
                      <p className="text-sm text-red-700">{erro}</p>
                      <button
                        type="button"
                        onClick={carregarEnderecos}
                        className="text-[13px] font-semibold uppercase tracking-[0.14em] text-red-700 underline underline-offset-4 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  ) : enderecos.length === 0 && !mostrarFormulario ? (
                    <div>
                      <EmptyState
                        eyebrow="Endereços"
                        title="Você ainda não tem nenhum endereço"
                        message="Cadastre o primeiro endereço de entrega para continuar."
                        compact
                      />
                      <div className="flex justify-center">
                        <Button onClick={() => setMostrarFormulario(true)} variant="primary">
                          Cadastrar endereço
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">
                      {enderecos.length > 0 && (
                        <div
                          className="flex flex-col gap-3"
                          role="radiogroup"
                          aria-label="Selecione um endereço"
                        >
                          {enderecos.map((endereco) => (
                            <EnderecoCard
                              key={endereco.id}
                              endereco={endereco}
                              selecionado={endereco.id === enderecoSelecionadoId}
                              onSelecionar={() => setEnderecoSelecionadoId(endereco.id)}
                            />
                          ))}
                        </div>
                      )}

                      {mostrarFormulario ? (
                        <EnderecoForm
                          onSubmit={handleCadastrarEndereco}
                          onCancel={enderecos.length > 0 ? () => setMostrarFormulario(false) : undefined}
                        />
                      ) : (
                        // Task 18: mesmo sublinhado-revelado do carrinho
                        // (Task 17, "Esvaziar carrinho") em vez do
                        // underline estático de antes.
                        <button
                          type="button"
                          onClick={() => setMostrarFormulario(true)}
                          className="group relative w-fit text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-navy transition-colors hover:text-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                        >
                          + Adicionar novo endereço
                          <span
                            aria-hidden
                            className="absolute inset-x-0 -bottom-1 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                          />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </RevealOnScroll>

            <RevealOnScroll delayMs={90}>
              <aside className="rounded-sm border border-slate-200 p-6 lg:sticky lg:top-28">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-serif text-xl font-normal text-brand-navy">
                    Resumo do pedido
                  </h2>
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    {totalItens} {totalItens === 1 ? "item" : "itens"}
                  </p>
                </div>

                <ul className="mt-4 divide-y divide-slate-200 border-t border-slate-200">
                  {itens.map((item) => (
                    <CheckoutItemRow key={item.produtoId} item={item} />
                  ))}
                </ul>

                {/* Total = subtotal por enquanto — frete/cupom/desconto não
                    fazem parte desta task. */}
                <dl className="mt-2 space-y-3 border-t border-slate-200 pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-slate-500">Subtotal</dt>
                    <dd className="font-medium tabular-nums text-brand-navy">
                      {formatPrice.format(subtotal)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-base">
                    <dt className="font-semibold text-brand-navy">Total</dt>
                    <dd className="text-lg font-semibold tabular-nums text-brand-navy">
                      {formatPrice.format(subtotal)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6 flex flex-col gap-3">
                  <Button
                    onClick={handleContinuar}
                    variant="primary"
                    className="w-full"
                    disabled={carregando || criandoSessao}
                  >
                    {criandoSessao ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <span
                          aria-hidden
                          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
                        />
                        Processando...
                      </span>
                    ) : (
                      "Continuar para pagamento →"
                    )}
                  </Button>
                  <Link
                    href={ROUTES.LOJA_CARRINHO}
                    className="text-center text-[13px] uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40"
                  >
                    ← Voltar ao carrinho
                  </Link>
                </div>
              </aside>
            </RevealOnScroll>
          </div>
        </section>
      )}
    </>
  );
}
