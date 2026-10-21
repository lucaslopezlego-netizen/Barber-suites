// Lista de barras horizontales (una sola serie, magnitud): etiqueta + valor en
// tinta de texto, barra fina dorada con extremos redondeados.
export function BarList({ items, format = (n: number) => String(n), empty = "Sin datos todavía." }: {
  items: { label: string; value: number; hint?: string }[];
  format?: (n: number) => string;
  empty?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (items.length === 0 || max === 0) return <p className="text-sm text-subtle">{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label} title={`${i.label}: ${format(i.value)}${i.hint ? ` (${i.hint})` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-fg">{i.label}</span>
            <span className="shrink-0 font-semibold text-fg tabular-nums">
              {format(i.value)}
              {i.hint && <span className="ml-1.5 font-normal text-subtle">{i.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-2 rounded-full bg-gold" style={{ width: `${Math.max(2, (i.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
