import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("settings")
    .select("slot_interval_min, min_notice_min, max_days_ahead, buffer_min, whatsapp, address, instagram")
    .eq("id", 1)
    .single();
  return (
    <>
      <PageHeader title="Ajustes" subtitle="Reglas de las reservas y datos de contacto." />
      {data ? <SettingsForm settings={data} /> : <p className="card p-6 text-muted">No se pudieron cargar los ajustes.</p>}
    </>
  );
}
