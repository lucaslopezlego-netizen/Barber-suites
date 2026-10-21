import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { moveBarber, toggleBarberActive } from "@/app/admin/actions";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActiveToggle, MoveButtons } from "@/components/admin/RowActions";
import { Avatar } from "@/components/ui/Avatar";
import { requireAdmin } from "@/lib/admin/auth";

export const metadata = { title: "Barberos" };

export default async function BarberosPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("barbers").select("id, name, photo_url, bio, active, sort_order, barber_services(count)").order("sort_order").order("name");
  const barbers = data ?? [];

  return (
    <>
      <PageHeader
        title="Barberos"
        subtitle="El orden de esta lista es el orden en que aparecen en la web."
        action={
          <Link href="/admin/barberos/nuevo" className="btn-primary !py-2.5 text-sm">
            <Plus className="size-4" /> Agregar barbero
          </Link>
        }
      />
      {barbers.length === 0 ? (
        <p className="card p-8 text-center text-muted">Aún no hay barberos. Agrega el primero.</p>
      ) : (
        <ul className="space-y-3">
          {barbers.map((b, i) => {
            const count = (b.barber_services as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <li key={b.id} className={`card flex flex-wrap items-center gap-4 p-4 ${b.active ? "" : "opacity-70"}`}>
                <Avatar name={b.name} src={b.photo_url} size={56} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-sm text-muted">
                    {count} {count === 1 ? "servicio" : "servicios"}
                    {!b.photo_url && <span className="text-warn"> · sin foto</span>}
                  </p>
                </div>
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
                  <ActiveToggle active={b.active} label={`Activar ${b.name}`} onToggle={toggleBarberActive.bind(null, b.id)} />
                  <div className="flex items-center gap-2">
                    <MoveButtons onMove={moveBarber.bind(null, b.id)} first={i === 0} last={i === barbers.length - 1} />
                    <Link href={`/admin/barberos/${b.id}`} className="btn-secondary !px-4 !py-2 text-sm">
                      <Pencil className="size-4" /> Editar
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-subtle">
        Un barbero inactivo deja de aparecer en la web y no recibe reservas, pero conserva su historial de citas.
      </p>
    </>
  );
}
