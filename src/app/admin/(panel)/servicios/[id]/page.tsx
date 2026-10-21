import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { ServiceForm } from "./ServiceForm";

export default async function ServicioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const isNew = id === "nuevo";
  const [{ data: service }, { data: barbers }, { data: rel }] = await Promise.all([
    isNew
      ? Promise.resolve({ data: null })
      : supabase.from("services").select("id, name, description, duration_min, price_usd, active, sort_order").eq("id", id).maybeSingle(),
    supabase.from("barbers").select("id, name, active").order("sort_order"),
    isNew ? Promise.resolve({ data: [] }) : supabase.from("barber_services").select("barber_id").eq("service_id", id),
  ]);
  if (!isNew && !service) notFound();

  return (
    <>
      <Link href="/admin/servicios" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Servicios
      </Link>
      <PageHeader title={isNew ? "Agregar servicio" : `Editar ${service!.name}`} />
      <ServiceForm service={service} barbers={barbers ?? []} selected={(rel ?? []).map((r: { barber_id: string }) => r.barber_id)} />
    </>
  );
}
