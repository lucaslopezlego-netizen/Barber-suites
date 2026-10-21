import { Ban } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { today } from "@/lib/admin/dates";
import { addDays, DEFAULT_TZ, formatDateLong, formatInstantTime, toZonedParts, zonedToUtc } from "@/lib/tz";
import { DeleteTimeOff, TimeOffForm } from "./TimeOffForm";

export const metadata = { title: "Bloqueos" };

function describe(startsAt: string, endsAt: string) {
  const s = toZonedParts(startsAt, DEFAULT_TZ);
  const e = toZonedParts(endsAt, DEFAULT_TZ);
  if (s.time === "00:00" && e.time === "00:00") {
    const last = addDays(e.date, -1);
    return last === s.date ? `${formatDateLong(s.date)} · todo el día` : `Del ${formatDateLong(s.date)} al ${formatDateLong(last)}`;
  }
  if (s.date === e.date) return `${formatDateLong(s.date)} · ${formatInstantTime(startsAt, DEFAULT_TZ)} a ${formatInstantTime(endsAt, DEFAULT_TZ)}`;
  return `${formatDateLong(s.date)} ${formatInstantTime(startsAt, DEFAULT_TZ)} → ${formatDateLong(e.date)} ${formatInstantTime(endsAt, DEFAULT_TZ)}`;
}

export default async function BloqueosPage() {
  const { supabase } = await requireAdmin();
  const since = zonedToUtc(addDays(today(), -7), "00:00", DEFAULT_TZ).toISOString();
  const [{ data: barbers }, { data: offs }] = await Promise.all([
    supabase.from("barbers").select("id, name").order("sort_order"),
    supabase.from("time_off").select("id, barber_id, starts_at, ends_at, reason").gte("ends_at", since).order("starts_at"),
  ]);
  const name = (id: string | null) => (id ? (barbers?.find((b) => b.id === id)?.name ?? "Barbero") : "Toda la barbería");
  const now = Date.now();

  return (
    <>
      <PageHeader title="Bloqueos" subtitle="Vacaciones, días libres, feriados o diligencias. En esos horarios no se aceptan reservas." />
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <TimeOffForm barbers={barbers ?? []} defaultDate={today()} />
        <section>
          <h2 className="mb-3 text-lg font-semibold">Próximos y recientes</h2>
          {!offs?.length ? (
            <p className="text-sm text-subtle">No hay bloqueos.</p>
          ) : (
            <ul className="space-y-2">
              {offs.map((o) => {
                const past = Date.parse(o.ends_at) < now;
                return (
                  <li key={o.id} className={`card flex items-start gap-3 p-4 ${past ? "opacity-55" : ""}`}>
                    <Ban className="mt-0.5 size-4 shrink-0 text-warn" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{name(o.barber_id)}</p>
                      <p className="text-sm text-muted first-letter:uppercase">{describe(o.starts_at, o.ends_at)}</p>
                      {o.reason && <p className="mt-1 text-xs text-subtle">{o.reason}</p>}
                    </div>
                    <DeleteTimeOff id={o.id} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
