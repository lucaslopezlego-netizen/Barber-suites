import { ArrowLeft, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingCard } from "@/components/admin/BookingCard";
import { requireAdmin } from "@/lib/admin/auth";
import { BOOKING_SELECT, STATUS_LABEL, type AdminBooking } from "@/lib/admin/types";
import { formatUsd } from "@/lib/booking-links";
import { formatPhone, normalizePhone, whatsappUrl } from "@/lib/phone";
import { DEFAULT_TZ, formatDateLong, toZonedParts } from "@/lib/tz";

export const metadata = { title: "Cliente" };

export default async function ClientePage({ params }: { params: Promise<{ telefono: string }> }) {
  const { telefono } = await params;
  const phone = normalizePhone(decodeURIComponent(telefono));
  const { supabase } = await requireAdmin();
  const [{ data: summary }, { data: rows }] = await Promise.all([
    supabase.from("admin_customers").select("*").eq("phone", phone).maybeSingle(),
    supabase.from("bookings").select(BOOKING_SELECT).eq("customer_phone", phone).order("starts_at", { ascending: false }).limit(100),
  ]);
  if (!summary) notFound();
  const bookings = (rows ?? []) as unknown as AdminBooking[];
  const now = Date.now();
  const upcoming = bookings.filter((b) => Date.parse(b.starts_at) >= now).reverse();
  const past = bookings.filter((b) => Date.parse(b.starts_at) < now);

  return (
    <>
      <Link href="/admin/clientes" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <div className="card mb-6 p-5">
        <h1 className="text-2xl font-bold">{summary.name}</h1>
        <p className="mt-1 text-muted">
          {formatPhone(phone)}
          {summary.email ? ` · ${summary.email}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={whatsappUrl(phone)} target="_blank" rel="noopener" className="btn-primary !py-2.5 text-sm">
            <MessageCircle className="size-4" /> WhatsApp
          </a>
          <a href={`tel:${phone}`} className="btn-secondary !py-2.5 text-sm">
            <Phone className="size-4" /> Llamar
          </a>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 sm:grid-cols-4">
          <Fact label="Visitas" value={String(summary.completed)} />
          <Fact label="Gastado" value={formatUsd(summary.total_spent_usd)} />
          <Fact label="No vino" value={String(summary.no_shows)} warn={summary.no_shows > 0} />
          <Fact label="Cliente desde" value={formatDateLong(toZonedParts(summary.first_seen, DEFAULT_TZ).date)} />
        </dl>
      </div>

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Próximas citas</h2>
          <div className="space-y-3">
            {upcoming.map((b) => (
              <BookingCard key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Historial</h2>
        {past.length === 0 ? (
          <p className="text-sm text-subtle">Sin citas pasadas.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {past.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="capitalize">{formatDateLong(toZonedParts(b.starts_at, DEFAULT_TZ).date)}</span>
                  <span className="text-muted">
                    {" "}
                    · {b.service?.name} · {b.barber?.name}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-subtle">{b.status === "completada" ? formatUsd(b.price_usd) : STATUS_LABEL[b.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className={`mt-0.5 font-semibold first-letter:uppercase ${warn ? "text-danger" : ""}`}>{value}</dd>
    </div>
  );
}
