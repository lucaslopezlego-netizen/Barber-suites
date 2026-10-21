import type { Metadata } from "next";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { BUSINESS } from "@/lib/business";
import { getCatalog } from "@/lib/public-data";

export const metadata: Metadata = {
  title: "Reservar cita",
  description: `Reserva tu cita en ${BUSINESS.name}: elige barbero, servicio, día y hora.`,
};

export const dynamic = "force-dynamic";

export default async function ReservarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const catalog = await getCatalog();
  const whatsapp = catalog?.info.whatsapp ?? BUSINESS.phone;

  return (
    <>
      <SiteHeader whatsapp={whatsapp} />
      <main className="mx-auto min-h-[70dvh] max-w-2xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
        <h1 className="mb-8 text-3xl font-bold tracking-tight sm:text-4xl">Reserva tu cita</h1>
        <BookingFlow
          barbers={catalog?.snapshot.barbers ?? []}
          services={catalog?.snapshot.services ?? []}
          maxDaysAhead={catalog?.info.max_days_ahead ?? 30}
          timezone={catalog?.info.timezone ?? BUSINESS.timezone}
          whatsapp={whatsapp}
          initialBarberId={params.barbero}
          initialServiceId={params.servicio}
        />
      </main>
      <SiteFooter whatsapp={whatsapp} instagram={catalog?.info.instagram} />
    </>
  );
}
