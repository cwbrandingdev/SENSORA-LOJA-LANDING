"use client";

// Seletor flutuante usado para comparar designs de uma seção na própria página
// (Sobre a Sensora, Coleções, Quem somos, Admin...). Mesmo visual de todas as
// rodadas: barra azul-marinho fixa embaixo no centro, opção ativa em laranja,
// linha "Design" e, opcionalmente, a linha "Posição" (Esquerda/Centro/Direita).
//
// Uso (numa página com variantes temporárias):
//
//   const [design, setDesign] = useState<Design>("a");
//   const [posicao, setPosicao] = useState<Posicao>("esquerda");
//
//   <div key={`${design}-${posicao}`}>...design escolhido...</div>
//   <DesignSwitcher
//     designs={DESIGNS}
//     design={design}
//     onDesign={setDesign}
//     posicao={posicao}
//     onPosicao={setPosicao}
//     mostrarPosicao={design !== "atual"}
//   />
//
// Depois da escolha, remover o seletor e as variantes da página — este
// arquivo fica aqui para as próximas rodadas.

export type Posicao = "esquerda" | "centro" | "direita";

export const POSICOES: { id: Posicao; label: string }[] = [
  { id: "esquerda", label: "Esquerda" },
  { id: "centro", label: "Centro" },
  { id: "direita", label: "Direita" },
];

function Pilula<T extends string>({
  opcoes,
  valor,
  onChange,
  rotulo,
}: {
  opcoes: { id: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  rotulo: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="hidden px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60 sm:inline">
        {rotulo}
      </span>
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-semibold transition-colors ${
            valor === o.id ? "bg-brand-orange text-white" : "text-white/80 hover:bg-white/10"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function DesignSwitcher<D extends string>({
  designs,
  design,
  onDesign,
  posicao,
  onPosicao,
  rotuloPosicao = "Posição",
  mostrarPosicao = true,
}: {
  designs: { id: D; label: string }[];
  design: D;
  onDesign: (v: D) => void;
  posicao?: Posicao;
  onPosicao?: (v: Posicao) => void;
  rotuloPosicao?: string;
  mostrarPosicao?: boolean;
}) {
  return (
    <div className="fixed bottom-4 left-1/2 z-100 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-1 rounded-3xl bg-brand-navy p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.35)] ring-1 ring-white/10">
      <div className="overflow-x-auto">
        <Pilula rotulo="Design" opcoes={designs} valor={design} onChange={onDesign} />
      </div>
      {mostrarPosicao && posicao && onPosicao && (
        <div className="flex justify-center border-t border-white/10 pt-1">
          <Pilula rotulo={rotuloPosicao} opcoes={POSICOES} valor={posicao} onChange={onPosicao} />
        </div>
      )}
    </div>
  );
}
