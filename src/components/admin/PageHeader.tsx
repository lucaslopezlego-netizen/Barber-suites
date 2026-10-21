export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="title-display text-2xl sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted first-letter:uppercase">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
