import { Clock, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { toggleServiceActive } from "@/app/admin/actions";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActiveToggle } from "@/components/admin/RowActions";
import { requireAdmin } from "@/lib/admin/auth";
import { formatUsd } from "@/lib/booking-links";

export const metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("services")
    .select("id, name, description, duration_min, price_usd, active, barber_services(barber:barbers(name))")
    .order("sort_order")
    .order("name");
  const services = data ?? [];

  return (
    <>
      <PageHeader
        title="Servicios"
        subtitle="Precios en USD."
        action={
          <Link href="/admin/servicios/nuevo" className="btn-gold !py-2.5 text-sm">
            <Plus className="size-4" /> Agregar servicio
          </Link>
        }
      />
      {services.length === 0 ? (
        <p className="card p-8 text-center text-muted">Aún no hay servicios.</p>
      ) : (
        <ul className="space-y-3">
          {services.map((s) => {
            const names = ((s.barber_services ?? []) as unknown as { barber: { name: string } | null }[]).map((r) => r.barber?.name).filter(Boolean);
            return (
              <li key={s.id} className={`card flex flex-wrap items-center gap-4 p-4 ${s.active ? "" : "opacity-70"}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-semibold">{s.name}</p>
                    <p className="font-display text-lg font-semibold text-gold-soft">{formatUsd(s.price_usd)}</p>
                  </div>
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted">
                    <Clock className="size-3.5" /> {s.duration_min} min
                  </p>
                  <p className={`mt-1 text-xs ${names.length ? "text-subtle" : "text-warn"}`}>
                    {names.length ? `Lo hacen: ${names.join(", ")}` : "Ningún barbero lo tiene asignado: no se puede reservar."}
                  </p>
                </div>
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
                  <ActiveToggle active={s.active} label={`Activar ${s.name}`} onToggle={toggleServiceActive.bind(null, s.id)} />
                  <Link href={`/admin/servicios/${s.id}`} className="btn-ghost !px-4 !py-2 text-sm">
                    <Pencil className="size-4" /> Editar
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
