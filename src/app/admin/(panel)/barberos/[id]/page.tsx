import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { requireAdmin } from "@/lib/admin/auth";
import { BarberForm } from "./BarberForm";

export default async function BarberoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const isNew = id === "nuevo";
  const [{ data: barber }, { data: services }, { data: rel }] = await Promise.all([
    isNew ? Promise.resolve({ data: null }) : supabase.from("barbers").select("id, name, bio, photo_url, active").eq("id", id).maybeSingle(),
    supabase.from("services").select("id, name, active").order("sort_order"),
    isNew ? Promise.resolve({ data: [] }) : supabase.from("barber_services").select("service_id").eq("barber_id", id),
  ]);
  if (!isNew && !barber) notFound();

  return (
    <>
      <Link href="/admin/barberos" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-cream">
        <ArrowLeft className="size-4" /> Barberos
      </Link>
      <PageHeader title={isNew ? "Agregar barbero" : `Editar a ${barber!.name}`} />
      <BarberForm
        barber={barber}
        services={services ?? []}
        selected={(rel ?? []).map((r: { service_id: string }) => r.service_id)}
      />
      {!isNew && (
        <p className="mt-4 max-w-xl text-sm text-muted">
          Para cambiar su horario semanal ve a{" "}
          <Link href={`/admin/horarios?barbero=${barber!.id}`} className="text-gold underline underline-offset-4">
            Horarios
          </Link>
          .
        </p>
      )}
    </>
  );
}
