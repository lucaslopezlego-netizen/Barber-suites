import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { HoursEditor } from "./HoursEditor";

export const metadata = { title: "Horarios" };

export default async function HorariosPage({ searchParams }: { searchParams: Promise<{ barbero?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: barbers } = await supabase.from("barbers").select("id, name, active").order("sort_order");
  const list = barbers ?? [];
  const current = list.find((b) => b.id === sp.barbero) ?? list[0];

  const { data: hours } = current
    ? await supabase.from("working_hours").select("weekday, start_time, end_time").eq("barber_id", current.id).order("weekday").order("start_time")
    : { data: [] };

  return (
    <>
      <PageHeader title="Horarios" subtitle="Horario semanal de cada barbero. Para un día puntual usa Bloqueos." />
      {list.length === 0 ? (
        <p className="card p-8 text-center text-muted">Primero agrega un barbero.</p>
      ) : (
        <>
          <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {list.map((b) => (
              <Link
                key={b.id}
                href={`/admin/horarios?barbero=${b.id}`}
                aria-current={current?.id === b.id ? "page" : undefined}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium whitespace-nowrap ${
                  current?.id === b.id ? "border-gold bg-gold/15 text-gold-soft" : "border-line-strong text-muted hover:text-cream"
                }`}
              >
                {b.name}
                {!b.active && " (inactivo)"}
              </Link>
            ))}
          </div>
          {current && (
            <HoursEditor
              key={current.id}
              barberId={current.id}
              barberName={current.name}
              initial={(hours ?? []).map((h) => ({ weekday: h.weekday, start_time: h.start_time.slice(0, 5), end_time: h.end_time.slice(0, 5) }))}
            />
          )}
        </>
      )}
    </>
  );
}
