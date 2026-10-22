/* eslint-disable @next/next/no-img-element */

import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock3, LayoutDashboard, LogOut, MessageCircle, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BarList } from "@/components/admin/BarList";
import { BookingCard } from "@/components/admin/BookingCard";
import { PageHeader } from "@/components/admin/PageHeader";
import { HoursEditor } from "@/app/admin/(panel)/horarios/HoursEditor";
import { countsAsRevenue, STATUS_LABEL, type AdminBooking } from "@/lib/admin/types";
import { formatUsd } from "@/lib/booking-links";
import { formatPhone, whatsappUrl } from "@/lib/phone";
import {
  addDays,
  blocksMinutes,
  DEFAULT_TZ,
  formatDateLong,
  formatDateShort,
  formatDuration,
  formatInstantTime,
  formatRangeShort,
  todayIn,
  toZonedParts,
  weekdayOf,
  WEEKDAY_SHORT,
} from "@/lib/tz";
import { ASSETS } from "./assets";
import { store, useStore, type Booking } from "./store";

type View = "resumen" | "agenda" | "horarios" | "clientes";
const NAV: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "agenda", label: "Agenda", icon: CalendarDays },
  { id: "horarios", label: "Horarios", icon: Clock3 },
  { id: "clientes", label: "Clientes", icon: Users },
];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function toAdmin(b: Booking): AdminBooking {
  const barber = store.barbers.find((x) => x.id === b.barber_id) ?? null;
  const service = store.services.find((x) => x.id === b.service_id) ?? null;
  return {
    id: b.id,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    status: b.status,
    source: b.source,
    price_usd: b.price_usd,
    customer_name: b.customer_name,
    customer_phone: b.customer_phone,
    customer_email: b.customer_email,
    notes: b.notes,
    created_at: b.created_at,
    barber: barber && { id: barber.id, name: barber.name },
    service: service && { id: service.id, name: service.name, duration_min: service.duration_min },
  };
}
const dateOf = (iso: string) => toZonedParts(iso, DEFAULT_TZ).date;
const sorted = (list: Booking[]) => [...list].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

export function DemoAdmin() {
  const [view, setView] = useState<View>("resumen");
  useEffect(() => window.scrollTo({ top: 0 }), [view]);


  return (
    <div className="min-h-[80vh] bg-surface">
      <div className="mx-auto flex max-w-6xl gap-8 px-4 pt-6 pb-28 sm:px-6 lg:pb-12">
        {/* Escritorio: menú lateral */}
        <aside className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-20 rounded-2xl border border-line bg-page p-3">
            <div className="mb-4 flex items-center gap-2 px-2 pt-1">
              <img src={ASSETS.logo} alt="" className="size-8" />
              <span className="text-sm font-semibold">Panel Barber Suites</span>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Panel">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  aria-current={view === id ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    view === id ? "bg-surface-2 font-semibold text-onyx" : "text-muted hover:bg-surface-2 hover:text-fg"
                  }`}
                >
                  <Icon className="size-[18px]" /> {label}
                </button>
              ))}
            </nav>
            <p className="mt-4 border-t border-line px-3 pt-3 text-xs text-subtle">
              En el panel real también están Barberos, Bloqueos, Servicios y Ajustes.
            </p>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("demo:lock"))} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-surface-2">
              <LogOut className="size-[18px]" /> Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {view === "resumen" && <Resumen go={setView} />}
          {view === "agenda" && <Agenda />}
          {view === "horarios" && <Horarios />}
          {view === "clientes" && <Clientes />}
        </main>
      </div>

      {/* Celular: barra inferior */}
      <nav
        aria-label="Panel"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-current={view === id ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${view === id ? "text-onyx" : "text-muted"}`}
          >
            <Icon className="size-[22px]" /> {label}
          </button>
        ))}
        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("demo:lock"))} className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted">
          <LogOut className="size-[22px]" /> Salir
        </button>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
function Resumen({ go }: { go: (v: View) => void }) {
  const s = useStore();
  const today = todayIn(DEFAULT_TZ);
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const from30 = addDays(today, -29);
  const all = s.bookings;
  const todays = all.filter((b) => dateOf(b.starts_at) === today && b.status !== "cancelada");
  const week = all.filter((b) => dateOf(b.starts_at) >= monday && dateOf(b.starts_at) < addDays(monday, 7) && b.status !== "cancelada");
  const last30 = all.filter((b) => dateOf(b.starts_at) >= from30 && dateOf(b.starts_at) <= today);
  const revenue = (l: Booking[]) => l.filter((b) => countsAsRevenue(b.status)).reduce((x, b) => x + b.price_usd, 0);
  const completed = last30.filter((b) => b.status === "completada").length;
  const noShow = last30.filter((b) => b.status === "no_asistio").length;
  const pending = sorted(all.filter((b) => b.status === "pendiente" && Date.parse(b.starts_at) >= Date.now()));
  const next = sorted(all.filter((b) => Date.parse(b.starts_at) >= Date.now() && (b.status === "pendiente" || b.status === "confirmada")))[0];
  const tally = (key: (b: Booking) => string) => {
    const m = new Map<string, { count: number; revenue: number }>();
    for (const b of last30) {
      if (b.status === "cancelada") continue;
      const k = key(b);
      const cur = m.get(k) ?? { count: 0, revenue: 0 };
      cur.count++;
      if (countsAsRevenue(b.status)) cur.revenue += b.price_usd;
      m.set(k, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count).map(([label, v]) => ({ label, value: v.count, hint: formatUsd(v.revenue) }));
  };

  return (
    <>
      <PageHeader title="Resumen" subtitle={formatDateLong(today, true)} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Citas hoy" value={String(todays.length)} hint={`${todays.filter((b) => b.status === "pendiente").length} sin confirmar`} />
        <Stat label="Ingreso estimado hoy" value={formatUsd(revenue(todays))} hint="sin canceladas ni inasistencias" />
        <Stat label="Esta semana" value={String(week.length)} hint={`${formatUsd(revenue(week))} estimado`} />
        <Stat
          label="Inasistencias (30 días)"
          value={completed + noShow ? `${Math.round((noShow / (completed + noShow)) * 100)}%` : "—"}
          hint={`${noShow} de ${completed + noShow} citas pasadas`}
        />
      </section>
      {next && (
        <div className="card mt-6 flex items-center gap-4 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-gold">
            <CalendarClock className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-subtle">Próxima cita</p>
            <p className="truncate font-semibold">
              {formatDateShort(dateOf(next.starts_at))}, {formatInstantTime(next.starts_at)}: {next.customer_name}
            </p>
          </div>
        </div>
      )}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Reservas por confirmar {pending.length > 0 && <span className="text-sm font-normal text-subtle">({pending.length})</span>}
          </h2>
          {pending.length === 0 ? (
            <p className="text-sm text-subtle">Todo al día: no hay reservas pendientes.</p>
          ) : (
            <div className="space-y-3">
              {pending.map((b) => (
                <div key={b.id}>
                  <p className="mb-1.5 text-xs font-medium text-subtle first-letter:uppercase">{formatDateLong(dateOf(b.starts_at))}</p>
                  <BookingCard b={toAdmin(b)} />
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={() => go("agenda")} className="mt-4 text-sm font-semibold text-gold hover:text-gold-strong">
            Ver la agenda completa
          </button>
        </section>
        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold">Servicios más pedidos</h2>
            <p className="mb-4 text-xs text-subtle">Últimos 30 días · número de citas</p>
            <BarList items={tally((b) => s.services.find((x) => x.id === b.service_id)!.name)} />
          </div>
          <div className="card p-5">
            <h2 className="font-semibold">Citas por barbero</h2>
            <p className="mb-4 text-xs text-subtle">Últimos 30 días · número de citas</p>
            <BarList items={tally((b) => s.barbers.find((x) => x.id === b.barber_id)!.name)} />
          </div>
        </aside>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-subtle">{hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Agenda() {
  const s = useStore();
  const today = todayIn(DEFAULT_TZ);
  const [date, setDate] = useState(() => {
    const next = sorted(s.bookings.filter((b) => Date.parse(b.starts_at) >= Date.now()))[0];
    return next ? dateOf(next.starts_at) : today;
  });
  const [barber, setBarber] = useState<string | null>(null);
  const list = sorted(s.bookings.filter((b) => dateOf(b.starts_at) === date && (!barber || b.barber_id === barber)));
  const active = list.filter((b) => b.status !== "cancelada");

  return (
    <>
      <PageHeader title="Agenda" subtitle={formatDateLong(date, true)} />
      <div className="mb-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-full border border-line-strong bg-page">
            <button type="button" onClick={() => setDate(addDays(date, -1))} className="grid size-11 place-items-center rounded-l-full hover:bg-surface-2" aria-label="Día anterior">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => setDate(today)} className="px-3 text-sm font-medium">
              Hoy
            </button>
            <button type="button" onClick={() => setDate(addDays(date, 1))} className="grid size-11 place-items-center rounded-r-full hover:bg-surface-2" aria-label="Día siguiente">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ id: null, name: "Todos" }, ...s.barbers].map((b) => (
            <button
              key={b.id ?? "all"}
              type="button"
              onClick={() => setBarber(b.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${barber === b.id ? "border-onyx bg-onyx text-white" : "border-line-strong bg-page text-muted hover:text-fg"}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-sm text-muted">
        {active.length} {active.length === 1 ? "cita" : "citas"}, {formatUsd(active.filter((b) => countsAsRevenue(b.status)).reduce((x, b) => x + b.price_usd, 0))} estimado
      </p>
      {list.length === 0 ? (
        <div className="card p-8 text-center text-muted">No hay citas este día. Usa las flechas para ver otros días.</div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => (
            <BookingCard key={b.id} b={toAdmin(b)} showBarber={!barber} />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
function Horarios() {
  const s = useStore();
  const [current, setCurrent] = useState(s.barbers[0].id);
  const of = (id: string, d?: number) => s.workingHours.filter((w) => w.barber_id === id && (d === undefined || w.weekday === d)).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const barber = s.barbers.find((b) => b.id === current)!;
  // El editor se reinicia solo al cambiar de barbero (no al guardar)
  const initial = useMemo(() => of(current).map(({ weekday, start_time, end_time }) => ({ weekday, start_time, end_time })), [current]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Horarios" subtitle="El horario fijo de cada semana. Para vacaciones o un día puntual usa Bloqueos." />
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Semana del equipo</h2>
        <ul className="card divide-y divide-line overflow-hidden md:hidden">
          {s.barbers.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => setCurrent(b.id)} className={`block w-full px-4 py-3.5 text-left ${b.id === current ? "bg-surface" : ""}`}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className={b.id === current ? "font-semibold text-onyx" : "font-medium"}>{b.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{formatDuration(blocksMinutes(of(b.id)))}</span>
                </span>
                <span className="mt-2 grid grid-cols-7 gap-1.5">
                  {ORDER.map((d) => (
                    <span
                      key={d}
                      className={`grid h-8 place-items-center rounded-lg text-xs font-semibold ${of(b.id, d).length ? "bg-onyx text-white" : "border border-line-strong text-subtle"}`}
                    >
                      {WEEKDAY_SHORT[d].slice(0, 2)}
                    </span>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-line text-subtle">
              <tr>
                <th className="px-4 py-3 font-medium">Barbero</th>
                {ORDER.map((d) => (
                  <th key={d} className="px-2 py-3 text-center font-medium">
                    {WEEKDAY_SHORT[d]}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s.barbers.map((b) => (
                <tr key={b.id} className={b.id === current ? "bg-surface" : "hover:bg-surface/60"}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    <button type="button" onClick={() => setCurrent(b.id)} className={`whitespace-nowrap underline-offset-4 hover:underline ${b.id === current ? "font-semibold text-onyx" : ""}`}>
                      {b.name}
                    </button>
                  </th>
                  {ORDER.map((d) => (
                    <td key={d} className="px-2 py-3 text-center align-top">
                      {of(b.id, d).length === 0 ? (
                        <span className="text-subtle">Libre</span>
                      ) : (
                        <span className="flex flex-col gap-0.5 text-xs whitespace-nowrap">
                          {of(b.id, d).map((x) => (
                            <span key={x.start_time}>{formatRangeShort(x.start_time, x.end_time)}</span>
                          ))}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatDuration(blocksMinutes(of(b.id)))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-subtle">Toca un barbero para cambiar su horario. En negro, los días que trabaja.</p>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Horario de {barber.name}</h2>
        <HoursEditor key={current} barberId={current} barberName={barber.name} initial={initial} />
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
function Clientes() {
  const s = useStore();
  const [q, setQ] = useState("");
  const customers = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of s.bookings) m.set(b.customer_phone, [...(m.get(b.customer_phone) ?? []), b]);
    return [...m.entries()]
      .map(([phone, list]) => ({
        phone,
        name: list[list.length - 1].customer_name,
        visits: list.filter((b) => b.status === "completada").length,
        noShows: list.filter((b) => b.status === "no_asistio").length,
        spent: list.filter((b) => b.status === "completada").reduce((x, b) => x + b.price_usd, 0),
        last: list.filter((b) => b.status === "completada").map((b) => b.starts_at).sort().at(-1) ?? null,
        next: list.filter((b) => Date.parse(b.starts_at) > Date.now() && b.status !== "cancelada").map((b) => b.starts_at).sort()[0] ?? null,
        history: sorted(list).reverse(),
      }))
      .sort((a, b) => b.visits - a.visits);
  }, [s.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const digits = q.replace(/\D/g, "").replace(/^0/, "");
  const shown = customers.filter((c) => !q.trim() || norm(c.name).includes(norm(q.trim())) || (digits.length >= 3 && c.phone.includes(digits)));
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Clientes" subtitle="Se crean solos a partir de las reservas (agrupados por teléfono)." />
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle" />
        <label htmlFor="demo-q" className="sr-only">
          Buscar cliente
        </label>
        <input id="demo-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono (prueba con maria)" className="field !pl-11" />
      </div>
      <ul className="space-y-2">
        {shown.map((c) => (
          <li key={c.phone} className="card p-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setOpen(open === c.phone ? null : c.phone)} className="min-w-0 flex-1 text-left" aria-expanded={open === c.phone}>
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-sm text-muted">{formatPhone(c.phone)}</p>
                <p className="mt-1 text-xs text-subtle">
                  {c.visits} visitas, {formatUsd(c.spent)} gastado
                  {c.last ? `, última el ${formatDateShort(dateOf(c.last))}` : ""}
                  {c.noShows > 0 && <span className="text-danger">, {c.noShows} no vino</span>}
                  {c.next && <span className="text-gold-strong">, próxima cita el {formatDateShort(dateOf(c.next))}</span>}
                </p>
              </button>
              <a href={whatsappUrl(c.phone)} target="_blank" rel="noopener" aria-label={`WhatsApp a ${c.name}`} className="grid size-10 shrink-0 place-items-center rounded-full border border-line-strong text-gold">
                <MessageCircle className="size-4" />
              </a>
            </div>
            {open === c.phone && (
              <ul className="mt-3 divide-y divide-line border-t border-line text-sm">
                {c.history.map((b) => (
                  <li key={b.id} className="flex justify-between gap-3 py-2">
                    <span className="first-letter:uppercase">
                      {formatDateShort(dateOf(b.starts_at))}, {store.services.find((x) => x.id === b.service_id)?.name}
                    </span>
                    <span className="shrink-0 text-xs text-subtle">{STATUS_LABEL[b.status]}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="card p-6 text-center text-muted">No encontramos clientes con esa búsqueda.</li>}
      </ul>
    </>
  );
}
