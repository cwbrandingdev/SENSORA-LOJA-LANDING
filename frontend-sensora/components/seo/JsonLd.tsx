// `<` escapado: textos vindos da API (ex.: descrição do produto) não podem
// fechar o <script> antes da hora.
export default function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
