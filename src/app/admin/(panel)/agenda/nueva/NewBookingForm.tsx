"use client";

import { useActionState, useMemo, useState } from "react";
import { createAdminBooking } from "@/app/admin/actions";
import { FormMessage, SubmitButton } from "@/components/admin/ui";
import { formatUsd } from "@/lib/booking-links";
import { DEFAULT_TZ, minutesToTime, toZonedParts } from "@/lib/tz";

interface Props {
  barbers: { id: string; name: string }[];
  services: { id: string; name: string; duration_min: number; price_usd: number }[];
  relations: { barber_id: string; service_id: string }[];
  defaultDate: string;
  defaultBarber?: string;
}

/** Hora actual redondeada a los próximos 15 min (hora de Caracas). */
function nextQuarter() {
  const p = toZonedParts(new Date(), DEFAULT_TZ);
  const m = Math.min(Math.ceil((p.hour * 60 + p.minute) / 15) * 15, 23 * 60 + 45);
  return minutesToTime(m);
}

export function NewBookingForm({ barbers, services, relations, defaultDate, defaultBarber }: Props) {
  const [state, action] = useActionState(createAdminBooking, null);
  const [barberId, setBarberId] = useState(barbers.some((b) => b.id === defaultBarber) ? defaultBarber! : (barbers[0]?.id ?? ""));
  const offered = useMemo(() => new Set(relations.filter((r) => r.barber_id === barberId).map((r) => r.service_id)), [relations, barberId]);
  const list = services.filter((s) => offered.has(s.id));

  if (barbers.length === 0 || services.length === 0) {
    return <p className="card p-6 text-muted">Primero crea al menos un barbero y un servicio activos.</p>;
  }

  return (
    <form action={action} className="card max-w-xl space-y-5 p-5 sm:p-6">
      <div>
        <label htmlFor="barber_id" className="label">
          Barbero
        </label>
        <select id="barber_id" name="barber_id" className="field" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="service_id" className="label">
          Servicio
        </label>
        <select id="service_id" name="service_id" className="field" key={barberId}>
          {list.length === 0 && <option value="">Este barbero no tiene servicios asignados</option>}
          {list.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.duration_min} min · {formatUsd(s.price_usd)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="date" className="label">
            Fecha
          </label>
          <input id="date" name="date" type="date" required defaultValue={defaultDate} className="field" />
        </div>
        <div>
          <label htmlFor="time" className="label">
            Hora
          </label>
          <input id="time" name="time" type="time" required step={300} defaultValue={nextQuarter()} className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="name" className="label">
          Nombre del cliente
        </label>
        <input id="name" name="name" required minLength={2} maxLength={80} autoComplete="off" className="field" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="label">
            Teléfono
          </label>
          <input id="phone" name="phone" type="tel" inputMode="tel" required placeholder="0414-1234567" className="field" />
        </div>
        <div>
          <label htmlFor="email" className="label">
            Email <span className="font-normal text-subtle">(opcional)</span>
          </label>
          <input id="email" name="email" type="email" className="field" />
        </div>
      </div>
      <div>
        <label htmlFor="status" className="label">
          Estado
        </label>
        <select id="status" name="status" defaultValue="confirmada" className="field">
          <option value="confirmada">Confirmada</option>
          <option value="pendiente">Pendiente</option>
          <option value="completada">Completada (ya se atendió)</option>
        </select>
      </div>
      <div>
        <label htmlFor="notes" className="label">
          Notas <span className="font-normal text-subtle">(opcional)</span>
        </label>
        <textarea id="notes" name="notes" maxLength={500} className="field min-h-20" />
      </div>
      <label className="flex items-start gap-3 text-sm text-muted">
        <input type="checkbox" name="enforce" className="mt-0.5 size-5 accent-[var(--color-gold)]" />
        <span>
          Respetar el horario y los bloqueos del barbero
          <span className="block text-xs text-subtle">Si lo dejas sin marcar, puedes agendar fuera de horario. Nunca se permiten dos citas a la vez.</span>
        </span>
      </label>
      <FormMessage state={state} />
      <SubmitButton>Guardar cita</SubmitButton>
    </form>
  );
}
