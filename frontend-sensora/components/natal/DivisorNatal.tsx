// Divisor entre as seções da home no tema de Natal: filetes dourados com
// um raminho de pinheiro, duas bolinhas e uma estrela no meio.
export default function DivisorNatal() {
  return (
    <div aria-hidden className="flex items-center justify-center gap-4 bg-[#f5f2ed] py-6">
      <span className="h-px w-20 bg-linear-to-r from-transparent to-[#d9b36c] sm:w-40" />
      <svg width="88" height="28" viewBox="0 0 88 28" fill="none">
        {/* Raminhos de pinheiro dos dois lados. */}
        <path d="M4 16c8-1 16-1 26 0" stroke="#2f5d3a" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 16l-4-4M16 16l-4-5M22 16l-3-5M10 16l-4 3M16 16l-4 4M22 16l-3 4" stroke="#2f5d3a" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M84 16c-8-1-16-1-26 0" stroke="#2f5d3a" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M78 16l4-4M72 16l4-5M66 16l3-5M78 16l4 3M72 16l4 4M66 16l3 4" stroke="#2f5d3a" strokeWidth="1.2" strokeLinecap="round" />
        {/* Bolinhas e estrela. */}
        <circle cx="33" cy="19" r="3" fill="#a8322d" />
        <circle cx="55" cy="19" r="3" fill="#a8322d" />
        <path
          className="natal-estrela origin-center"
          style={{ transformBox: "fill-box" }}
          d="M44 4l2.4 6.2 6.6.3-5.2 4.1 1.8 6.4L44 17.3 38.4 21l1.8-6.4-5.2-4.1 6.6-.3L44 4z"
          fill="#d9b36c"
        />
      </svg>
      <span className="h-px w-20 bg-linear-to-l from-transparent to-[#d9b36c] sm:w-40" />
    </div>
  );
}
