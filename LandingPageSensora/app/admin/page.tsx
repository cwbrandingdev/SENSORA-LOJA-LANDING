"use client";

// Client Component (não Server Component) pelo mesmo motivo de todas as
// outras páginas de /admin/**: o Next só evita renderizar o conteúdo de uma
// página no servidor — e portanto no HTML/RSC inicial, antes de
// ProtectedLayout decidir se autoriza o acesso — quando ela é "use client".
// Achado da auditoria: como Server Component, este dashboard era a única
// página do admin cujo conteúdo (ainda que só texto estático) chegava no
// payload de uma requisição não autenticada.
export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-brand-navy">Dashboard Sensora</h2>
      <p className="text-sm text-slate-600">Acesso permitido.</p>
    </div>
  );
}
