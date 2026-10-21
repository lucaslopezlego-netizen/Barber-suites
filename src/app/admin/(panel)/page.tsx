import { CalendarClock, Plus } from "lucide-react";
import Link from "next/link";
import { BarList } from "@/components/admin/BarList";
import { BookingCard } from "@/components/admin/BookingCard";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { dayRange, today as todayLocal, weekStart } from "@/lib/admin/dates";
import { BOOKING_SELECT, countsAsRevenue, type AdminBooking } from "@/lib/admin/types";
import { formatUsd } from "@/lib/booking-links";
import { addDays, DEFAULT_TZ, formatDateLong, formatInstantTime, toZonedParts } from "@/lib/tz";

export const metadata = { title: "Resumen" };

export default async function ResumenPage() {
  const { supabase } = await requireAdmin();
  const today = todayLocal();
  const monday = weekStart(today);
  const from30 = addDays(today, -29);
  const rangeStart = from30 < monday ? from30 : monday;
  const range = dayRange(rangeStart, addDays(monday, 7));

  const [{ data: rows }, { data: pendingRows }, { count: newClients }, { count: totalClients }] = await Promise.all([
    supabase.from("bookings").select(BOOKING_SELECT).gte("starts_at", range.from).lt("starts_at", range.to).order("starts_at"),
    supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("status", "pendiente")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(8),
    supabase.from("admin_customers").select("phone", { count: "exact", head: true }).gte("first_seen", dayRange(from30, from30).from),
    supabase.from("admin_customers").select("phone", { count: "exact", head: true }),
  ]);

  const bookings = (rows ?? []) as unknown as AdminBooking[];
  const pending = (pendingRows ?? []) as unknown as AdminBooking[];
  const dateOf = (b: AdminBooking) => toZonedParts(b.starts_at, DEFAULT_TZ).date;

  const todays = bookings.filter((b) => dateOf(b) === today && b.status !== "cancelada");
  const week = bookings.filter((b) => dateOf(b) >= monday && dateOf(b) < addDays(monday, 7) && b.status !== "cancelada");
  const last30 = bookings.filter((b) => dateOf(b) >= from30 && dateOf(b) <= today);

  const revenue = (list: AdminBooking[]) => list.filter((b) => countsAsRevenue(b.status)).reduce((s, b) => s + Number(b.price_usd), 0);
  const now = Date.now();
  const next = todays.find((b) => Date.parse(b.starts_at) >= now && (b.status === "pendiente" || b.status === "confirmada"));
  const upcomingToday = todays.filter((b) => Date.parse(b.ends_at) >= now && b.status !== "completada" && b.status !== "no_asistio");

  const completed30 = last30.filter((b) => b.status === "completada").length;
  const noShow30 = last30.filter((b) => b.status === "no_asistio").length;
  const noShowRate = completed30 + noShow30 > 0 ? Math.round((noShow30 / (completed30 + noShow30)) * 100) : null;

  const tally = (key: (b: AdminBooking) => string | undefined) => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const b of last30) {
      if (b.status === "cancelada") continue;
      const k = key(b);
      if (!k) continue;
      const cur = map.get(k) ?? { count: 0, revenue: 0 };
      cur.count++;
      if (countsAsRevenue(b.status)) cur.revenue += Number(b.price_usd);
      map.set(k, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].count - a[1].count);
  };
  const byService = tally((b) => b.service?.name);
  const byBarber = tally((b) => b.barber?.name);

  return (
    <>
      <PageHeader
        title="Resumen"
        subtitle={formatDateLong(today, true)}
        action={
          <Link href="/admin/agenda/nueva" className="btn-primary !py-2.5 text-sm">
            <Plus className="size-4" /> Nueva cita
          </Link>
        }
      />

      {/* Indicadores */}
      <section aria-label="Indicadores" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Citas hoy" value={String(todays.length)} hint={`${todays.filter((b) => b.status === "pendiente").length} sin confirmar`} />
        <Stat label="Ingreso estimado hoy" value={formatUsd(revenue(todays))} hint="sin canceladas ni inasistencias" />
        <Stat label="Esta semana" value={String(week.length)} hint={`${formatUsd(revenue(week))} estimado`} />
        <Stat
          label="Inasistencias (30 días)"
          value={noShowRate === null ? "—" : `${noShowRate}%`}
          hint={`${noShow30} de ${completed30 + noShow30} citas pasadas`}
        />
      </section>

      {/* Próxima cita */}
      <section className="mt-6">
        {next ? (
          <div className="card flex items-center gap-4 border-onyx/15 bg-surface p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
              <CalendarClock className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-subtle">Próxima cita</p>
              <p className="truncate font-semibold">
                {formatInstantTime(next.starts_at, DEFAULT_TZ)} · {next.customer_name}
              </p>
              <p className="truncate text-sm text-muted">
                {next.service?.name} con {next.barber?.name}
              </p>
            </div>
          </div>
        ) : (
          <p className="card p-4 text-sm text-muted">No quedan citas por atender hoy.</p>
        )}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          {/* Por confirmar */}
          <section>
            <SectionTitle title="Reservas por confirmar" count={pending.length} />
            {pending.length === 0 ? (
              <p className="text-sm text-subtle">Todo al día: no hay reservas pendientes.</p>
            ) : (
              <div className="space-y-3">
                {pending.map((b) => (
                  <div key={b.id}>
                    <p className="mb-1.5 text-xs font-medium text-subtle first-letter:uppercase">{formatDateLong(dateOf(b))}</p>
                    <BookingCard b={b} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Hoy */}
          <section>
            <SectionTitle title="Lo que queda de hoy" count={upcomingToday.length} link={{ href: `/admin/agenda?fecha=${today}`, label: "Ver agenda" }} />
            {upcomingToday.length === 0 ? (
              <p className="text-sm text-subtle">Nada más por hoy.</p>
            ) : (
              <div className="space-y-3">
                {upcomingToday.map((b) => (
                  <BookingCard key={b.id} b={b} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Últimos 30 días */}
        <aside className="space-y-6">
          <div className="card p-5">
            <h2 className="font-semibold">Servicios más pedidos</h2>
            <p className="mb-4 text-xs text-subtle">Últimos 30 días · número de citas</p>
            <BarList items={byService.map(([label, v]) => ({ label, value: v.count, hint: formatUsd(v.revenue) }))} />
          </div>
          <div className="card p-5">
            <h2 className="font-semibold">Citas por barbero</h2>
            <p className="mb-4 text-xs text-subtle">Últimos 30 días · número de citas</p>
            <BarList items={byBarber.map(([label, v]) => ({ label, value: v.count, hint: formatUsd(v.revenue) }))} />
          </div>
          <div className="card grid grid-cols-2 divide-x divide-line p-0">
            <div className="p-5">
              <p className="text-xs text-subtle">Clientes nuevos (30 días)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{newClients ?? 0}</p>
            </div>
            <div className="p-5">
              <p className="text-xs text-subtle">Clientes en total</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{totalClients ?? 0}</p>
            </div>
          </div>
          <Link href="/admin/clientes" className="text-sm font-semibold text-gold hover:text-gold-strong">
            Ver todos los clientes
          </Link>
        </aside>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  );
}

function SectionTitle({ title, count, link }: { title: string; count?: number; link?: { href: string; label: string } }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">
        {title}
        {count !== undefined && count > 0 && <span className="ml-2 text-sm font-normal text-subtle">({count})</span>}
      </h2>
      {link && (
        <Link href={link.href} className="text-sm text-gold hover:text-gold-strong">
          {link.label}
        </Link>
      )}
    </div>
  );
}
