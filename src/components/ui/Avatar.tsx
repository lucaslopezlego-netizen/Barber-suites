/* eslint-disable @next/next/no-img-element */
// Foto del barbero o sus iniciales sobre fondo dorado si aún no tiene foto.
export function Avatar({ name, src, size = 56, className = "" }: { name: string; src?: string | null; size?: number; className?: string }) {
  const initials = name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ring-1 ring-gold/40 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full bg-surface-2 font-display font-semibold text-gold-strong ring-1 ring-gold/40 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.34 }}
    >
      {initials || "BS"}
    </span>
  );
}
