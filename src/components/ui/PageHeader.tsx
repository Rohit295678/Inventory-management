export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-3xl sm:text-4xl font-normal tracking-tight text-brand-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-600 mt-1.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Alert({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-sm">
      {message}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-slate-600 py-10 text-sm">{children}</p>;
}
