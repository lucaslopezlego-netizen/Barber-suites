import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { isDateParam, today } from "@/lib/admin/dates";
import { NewBookingForm } from "./NewBookingForm";

export const metadata = { title: "Nueva cita" };

export default async function NuevaCitaPage({ searchParams }: { searchParams: Promise<{ fecha?: string; barbero?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: barbers }, { data: services }, { data: rel }] = await Promise.all([
    supabase.from("barbers").select("id, name").eq("active", true).order("sort_order"),
    supabase.from("services").select("id, name, duration_min, price_usd").eq("active", true).order("sort_order"),
    supabase.from("barber_services").select("barber_id, service_id"),
  ]);
  return (
    <>
      <PageHeader title="Nueva cita" subtitle="Para clientes sin cita previa o que reservan por teléfono." />
      <NewBookingForm
        barbers={barbers ?? []}
        services={services ?? []}
        relations={rel ?? []}
        defaultDate={isDateParam(sp.fecha) ? sp.fecha : today()}
        defaultBarber={sp.barbero}
      />
    </>
  );
}
