import { Ban, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { BookingCard } from "@/components/admin/BookingCard";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireAdmin } from "@/lib/admin/auth";
import { dayRange, isDateParam, today as todayLocal, weekStart } from "@/lib/admin/dates";
import { BOOKING_SELECT, countsAsRevenue, type AdminBooking } from "@/lib/admin/types";
import { formatUsd } from "@/lib/booking-links";
import { addDays, DEFAULT_TZ, formatDateLong, formatDateShort, formatInstantTime, toZonedParts } from "@/lib/tz";

export const metadata = { title: "Agenda" };

type Params = { fecha?: string; vista?: string; barbero?: string };

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const today = todayLocal();
  const date = isDateParam(sp.fecha) ? sp.fecha : today;
  const view = sp.vista === "semana" ? "semana" : "dia";
  const barberFilter = sp.barbero && /^[0-9a-f-]{36}$/i.test(sp.barbero) ? sp.barbero : null;

  const start = view === "semana" ? weekStart(date) : date;
  const end = addDays(start, view === "semana" ? 7 : 1);
  const range = dayRange(start, end);

  let bq = supabase.from("bookings").select(BOOKING_SELECT).gte("starts_at", range.from).lt("starts_at", range.to).order("starts_at");
  if (barberFilter) bq = bq.eq("barber_id", barberFilter);
  let tq = supabase.from("time_off").select("id, barber_id, starts_at, ends_at, reason").lt("starts_at", range.to).gt("ends_at", range.from);
  if (barberFilter) tq = tq.or(`barber_id.eq.${barberFilter},barber_id.is.null`);

  const [{ data: rows }, { data: barbers }, { data: offs }] = await Promise.all([
    bq,
    supabase.from("barbers").select("id, name, active").order("sort_order"),
    tq,
  ]);
  const bookings = (rows ?? []) as unknown as AdminBooking[];
  const barberName = (id: string | null) => (id ? (barbers?.find((b) => b.id === id)?.name ?? "Barbero") : "Toda la barbería");

  const href = (p: Partial<Params>) => {
    const q = new URLSearchParams();
    const merged = { fecha: date, vista: view, barbero: barberFilter ?? undefined, ...p };
    if (merged.fecha) q.set("fecha", merged.fecha);
    if (merged.vista && merged.vista !== "dia") q.set("vista", merged.vista);
    if (merged.barbero) q.set("barbero", merged.barbero);
    return `/admin/agenda?${q.toString()}`;
  };
  const step = view === "semana" ? 7 : 1;
  const active = bookings.filter((b) => b.status !== "cancelada");

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={view === "dia" ? formatDateLong(date, true) : `Semana del ${formatDateShort(start)} al ${formatDateShort(addDays(start, 6))}`}
        action={
          <Link href={`/admin/agenda/nueva?fecha=${date}${barberFilter ? `&barbero=${barberFilter}` : ""}`} className="btn-gold !py-2.5 text-sm">
            <Plus className="size-4" /> Nueva cita
          </Link>
        }
      />

      {/* Controles */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-line-strong">
            <Link href={href({ fecha: addDays(date, -step) })} className="grid size-11 place-items-center rounded-l-full hover:bg-panel-2" aria-label="Anterior">
              <ChevronLeft className="size-5" />
            </Link>
            <Link href={href({ fecha: today })} className="px-3 text-sm font-medium hover:text-gold">
              Hoy
            </Link>
            <Link href={href({ fecha: addDays(date, step) })} className="grid size-11 place-items-center rounded-r-full hover:bg-panel-2" aria-label="Siguiente">
              <ChevronRight className="size-5" />
            </Link>
          </div>
          <div className="flex rounded-full border border-line-strong p-1 text-sm">
            {(["dia", "semana"] as const).map((v) => (
              <Link
                key={v}
                href={href({ vista: v })}
                aria-current={view === v ? "page" : undefined}
                className={`rounded-full px-4 py-2 font-medium ${view === v ? "bg-gold text-ink" : "text-muted hover:text-cream"}`}
              >
                {v === "dia" ? "Día" : "Semana"}
              </Link>
            ))}
          </div>
          <form action="/admin/agenda" className="ml-auto">
            <input type="hidden" name="vista" value={view} />
            {barberFilter && <input type="hidden" name="barbero" value={barberFilter} />}
            <label className="sr-only" htmlFor="ir-fecha">
              Ir a fecha
            </label>
            <input id="ir-fecha" type="date" name="fecha" defaultValue={date} className="field !w-auto !py-2.5 text-sm" />
            <button className="sr-only">Ir</button>
          </form>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <FilterChip href={href({ barbero: "" })} active={!barberFilter} label="Todos" />
          {barbers?.map((b) => (
            <FilterChip key={b.id} href={href({ barbero: b.id })} active={barberFilter === b.id} label={b.active ? b.name : `${b.name} (inactivo)`} />
          ))}
        </div>
      </div>

      <p className="mb-4 text-sm text-muted">
        {active.length} {active.length === 1 ? "cita" : "citas"} · {formatUsd(active.filter((b) => countsAsRevenue(b.status)).reduce((s, b) => s + Number(b.price_usd), 0))}{" "}
        estimado
      </p>

      {view === "dia" ? (
        <div className="space-y-3">
          {(offs ?? []).map((o) => (
            <div key={o.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-line-strong p-4 text-sm text-muted">
              <Ban className="size-4 shrink-0 text-warn" />
              <span>
                <span className="text-cream">{barberName(o.barber_id)}</span> bloqueado {timeSpan(o.starts_at, o.ends_at, date)}
                {o.reason ? ` · ${o.reason}` : ""}
              </span>
            </div>
          ))}
          {bookings.length === 0 ? (
            <div className="card p-8 text-center text-muted">No hay citas este día.</div>
          ) : (
            bookings.map((b) => <BookingCard key={b.id} b={b} showBarber={!barberFilter} />)
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
            const dayBookings = bookings.filter((b) => toZonedParts(b.starts_at, DEFAULT_TZ).date === d);
            const dayOffs = (offs ?? []).filter((o) => Date.parse(o.starts_at) < Date.parse(dayRange(d, addDays(d, 1)).to) && Date.parse(o.ends_at) > Date.parse(dayRange(d, d).from));
            return (
              <section key={d} className={`card overflow-hidden ${d === today ? "border-gold/50" : ""}`}>
                <Link href={href({ fecha: d, vista: "dia" })} className="flex items-center justify-between border-b border-line px-4 py-3 hover:bg-panel-2">
                  <span className="font-semibold capitalize">
                    {formatDateShort(d)}
                    {d === today && <span className="ml-2 text-xs text-gold">Hoy</span>}
                  </span>
                  <span className="text-sm text-subtle">{dayBookings.filter((b) => b.status !== "cancelada").length} citas →</span>
                </Link>
                <ul className="divide-y divide-line">
                  {dayOffs.map((o) => (
                    <li key={o.id} className="flex items-center gap-2 px-4 py-2.5 text-xs text-muted">
                      <Ban className="size-3.5 text-warn" /> {barberName(o.barber_id)} bloqueado {timeSpan(o.starts_at, o.ends_at, d)}
                    </li>
                  ))}
                  {dayBookings.length === 0 && dayOffs.length === 0 && <li className="px-4 py-3 text-sm text-subtle">Sin citas</li>}
                  {dayBookings.map((b) => (
                    <li key={b.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${b.status === "cancelada" ? "opacity-50" : ""}`}>
                      <span className="w-[4.5rem] shrink-0 font-semibold tabular-nums">{formatInstantTime(b.starts_at, DEFAULT_TZ)}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {b.customer_name}
                        <span className="text-subtle">
                          {" "}
                          · {b.service?.name}
                          {!barberFilter && b.barber ? ` · ${b.barber.name}` : ""}
                        </span>
                      </span>
                      <StatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function timeSpan(startsAt: string, endsAt: string, date: string) {
  const s = toZonedParts(startsAt, DEFAULT_TZ);
  const e = toZonedParts(endsAt, DEFAULT_TZ);
  const fullDay = s.date <= date && (e.date > date || (e.date === addDays(date, 1) && e.time === "00:00")) && (s.date < date || s.time === "00:00");
  if (fullDay) return "todo el día";
  return `de ${s.date === date ? formatInstantTime(startsAt, DEFAULT_TZ) : "00:00"} a ${e.date === date ? formatInstantTime(endsAt, DEFAULT_TZ) : "fin del día"}`;
}

function FilterChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap ${
        active ? "border-gold bg-gold/15 text-gold-soft" : "border-line-strong text-muted hover:text-cream"
      }`}
    >
      {label}
    </Link>
  );
}
