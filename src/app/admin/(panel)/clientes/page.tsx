import { ChevronRight, MessageCircle, Search } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { formatUsd } from "@/lib/booking-links";
import { formatPhone, whatsappUrl } from "@/lib/phone";
import { DEFAULT_TZ, formatDateShort, toZonedParts } from "@/lib/tz";

export const metadata = { title: "Clientes" };

interface Customer {
  phone: string;
  name: string;
  email: string | null;
  total_bookings: number;
  completed: number;
  no_shows: number;
  cancelled: number;
  total_spent_usd: number;
  last_visit: string | null;
  next_booking: string | null;
  first_seen: string;
}

const SORTS = {
  recientes: { label: "Recientes", column: "first_seen" },
  visitas: { label: "Más visitas", column: "completed" },
  gasto: { label: "Mayor gasto", column: "total_spent_usd" },
} as const;

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; orden?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const q = (sp.q ?? "").trim().slice(0, 60);
  const sortKey = (sp.orden && sp.orden in SORTS ? sp.orden : "recientes") as keyof typeof SORTS;

  let query = supabase.from("admin_customers").select("*").order(SORTS[sortKey].column, { ascending: false }).limit(200);
  if (q) {
    // Sin acentos ni mayúsculas: "maria" encuentra a "María"
    const safe = q.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[%,()*]/g, " ");
    const digits = safe.replace(/\D/g, "");
    query =
      digits.length >= 3
        ? query.or(`search_name.ilike.%${safe}%,phone.ilike.%${digits.replace(/^0/, "")}%`)
        : query.ilike("search_name", `%${safe}%`);
  }
  const { data, count } = await query;
  const customers = (data ?? []) as Customer[];
  const fmtDate = (iso: string | null) => (iso ? formatDateShort(toZonedParts(iso, DEFAULT_TZ).date) : "—");

  return (
    <>
      <PageHeader title="Clientes" subtitle="Se crean solos a partir de las reservas (agrupados por teléfono)." />

      <form className="mb-4 flex flex-col gap-3 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle" />
          <label htmlFor="q" className="sr-only">
            Buscar cliente
          </label>
          <input id="q" name="q" defaultValue={q} placeholder="Buscar por nombre o teléfono" className="field !pl-11" />
        </div>
        <input type="hidden" name="orden" value={sortKey} />
        <button className="btn-secondary !py-3">Buscar</button>
      </form>
      <div className="mb-5 flex flex-wrap gap-2">
        {Object.entries(SORTS).map(([key, s]) => (
          <Link
            key={key}
            href={`/admin/clientes?orden=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full border px-3.5 py-1.5 text-sm ${sortKey === key ? "border-onyx bg-onyx text-white" : "border-line-strong text-muted"}`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {customers.length === 0 ? (
        <p className="card p-8 text-center text-muted">{q ? "No encontramos clientes con esa búsqueda." : "Aún no hay clientes. Aparecerán con la primera reserva."}</p>
      ) : (
        <>
          {/* Móvil: tarjetas */}
          <ul className="space-y-2 md:hidden">
            {customers.map((c) => (
              <li key={c.phone} className="card flex items-center gap-3 p-4">
                <Link href={`/admin/clientes/${encodeURIComponent(c.phone)}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  <p className="text-sm text-muted">{formatPhone(c.phone)}</p>
                  <p className="mt-1 text-xs text-subtle">
                    {c.completed} visitas · {formatUsd(c.total_spent_usd)} · última {fmtDate(c.last_visit)}
                    {c.no_shows > 0 && <span className="text-danger"> · {c.no_shows} no vino</span>}
                  </p>
                </Link>
                <a href={whatsappUrl(c.phone)} target="_blank" rel="noopener" aria-label={`WhatsApp a ${c.name}`} className="grid size-10 place-items-center rounded-full border border-line-strong text-gold">
                  <MessageCircle className="size-4" />
                </a>
              </li>
            ))}
          </ul>

          {/* Escritorio: tabla */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-sm text-subtle">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 text-right font-medium">Visitas</th>
                  <th className="px-4 py-3 text-right font-medium">No vino</th>
                  <th className="px-4 py-3 text-right font-medium">Gastado</th>
                  <th className="px-4 py-3 font-medium">Última visita</th>
                  <th className="px-4 py-3 font-medium">Próxima cita</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((c) => (
                  <tr key={c.phone} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/clientes/${encodeURIComponent(c.phone)}`} className="font-semibold hover:text-gold-strong">
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted">{formatPhone(c.phone)}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.completed}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${c.no_shows > 0 ? "text-danger" : "text-subtle"}`}>{c.no_shows}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatUsd(c.total_spent_usd)}</td>
                    <td className="px-4 py-3 capitalize">{fmtDate(c.last_visit)}</td>
                    <td className="px-4 py-3 capitalize">{c.next_booking ? <span className="text-gold-strong">{fmtDate(c.next_booking)}</span> : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/clientes/${encodeURIComponent(c.phone)}`} aria-label={`Ver ${c.name}`} className="text-muted hover:text-fg">
                        <ChevronRight className="inline size-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-subtle">Mostrando {customers.length}{count ? ` de ${count}` : ""} clientes.</p>
        </>
      )}
    </>
  );
}
