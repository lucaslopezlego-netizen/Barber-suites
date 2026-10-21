import { MessageCircle, Phone, StickyNote } from "lucide-react";
import { formatUsd } from "@/lib/booking-links";
import type { AdminBooking } from "@/lib/admin/types";
import { formatPhone, whatsappUrl } from "@/lib/phone";
import { DEFAULT_TZ, formatInstantTime } from "@/lib/tz";
import { StatusActions } from "./StatusActions";
import { StatusBadge } from "./StatusBadge";

export function BookingCard({ b, showBarber = true, compact = false }: { b: AdminBooking; showBarber?: boolean; compact?: boolean }) {
  const isPast = Date.parse(b.starts_at) < Date.now();
  const muted = b.status === "cancelada";
  const [hm, ...ampm] = formatInstantTime(b.starts_at, DEFAULT_TZ).split(" ");
  return (
    <article className={`card p-4 ${muted ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="w-16 shrink-0 text-center">
          <p className="text-lg leading-tight font-bold tabular-nums">{hm}</p>
          <p className="text-[11px] text-subtle">{ampm.join(" ")}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{b.customer_name}</h3>
            <StatusBadge status={b.status} />
            {b.source === "admin" && <span className="text-[11px] text-subtle">· creada en el panel</span>}
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {b.service?.name ?? "Servicio"} · {formatUsd(b.price_usd)}
            {showBarber && b.barber ? ` · ${b.barber.name}` : ""}
          </p>
          {!compact && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href={`tel:${b.customer_phone}`} className="inline-flex items-center gap-1.5 text-muted hover:text-cream">
                <Phone className="size-3.5" /> {formatPhone(b.customer_phone)}
              </a>
              <a
                href={whatsappUrl(b.customer_phone, `Hola ${b.customer_name.split(" ")[0]}, te escribimos de Barber Suites por tu cita.`)}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-1.5 text-gold hover:text-gold-soft"
              >
                <MessageCircle className="size-3.5" /> WhatsApp
              </a>
            </div>
          )}
          {b.notes && !compact && (
            <p className="mt-2 flex gap-1.5 rounded-lg bg-panel-2 px-3 py-2 text-sm text-muted">
              <StickyNote className="mt-0.5 size-3.5 shrink-0" /> {b.notes}
            </p>
          )}
          <div className="mt-3">
            <StatusActions id={b.id} status={b.status} isPast={isPast} />
          </div>
        </div>
      </div>
    </article>
  );
}
