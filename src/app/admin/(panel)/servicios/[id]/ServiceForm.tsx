"use client";

import { useActionState } from "react";
import { saveService } from "@/app/admin/actions";
import { FormMessage, SubmitButton } from "@/components/admin/ui";

interface Props {
  service: { id: string; name: string; description: string | null; duration_min: number; price_usd: number; active: boolean; sort_order: number } | null;
  barbers: { id: string; name: string; active: boolean }[];
  selected: string[];
}

const DURATIONS = [15, 20, 30, 40, 45, 60, 75, 90, 120, 150, 180];

export function ServiceForm({ service, barbers, selected }: Props) {
  const [state, action] = useActionState(saveService, null);
  const isNew = !service;
  const durations = service && !DURATIONS.includes(service.duration_min) ? [...DURATIONS, service.duration_min].sort((a, b) => a - b) : DURATIONS;

  return (
    <form action={action} className="card max-w-xl space-y-5 p-5 sm:p-6">
      {service && <input type="hidden" name="id" value={service.id} />}
      <div>
        <label htmlFor="name" className="label">
          Nombre
        </label>
        <input id="name" name="name" required minLength={2} maxLength={80} defaultValue={service?.name} className="field" placeholder="Ej.: Corte + barba" />
      </div>
      <div>
        <label htmlFor="description" className="label">
          Descripción <span className="font-normal text-subtle">(opcional)</span>
        </label>
        <textarea id="description" name="description" maxLength={280} defaultValue={service?.description ?? ""} className="field min-h-20" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="duration_min" className="label">
            Duración
          </label>
          <select id="duration_min" name="duration_min" defaultValue={service?.duration_min ?? 30} className="field">
            {durations.map((d) => (
              <option key={d} value={d}>
                {d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60} min` : ""}`}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="price_usd" className="label">
            Precio (USD)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">$</span>
            <input
              id="price_usd"
              name="price_usd"
              inputMode="decimal"
              required
              defaultValue={service?.price_usd ?? ""}
              className="field !pl-8"
              placeholder="10"
            />
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="sort_order" className="label">
          Posición en la lista <span className="font-normal text-subtle">(1 = primero)</span>
        </label>
        <input id="sort_order" name="sort_order" type="number" min={0} max={999} defaultValue={service?.sort_order ?? 10} className="field" />
      </div>
      <fieldset>
        <legend className="label">¿Qué barberos lo hacen?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {barbers.map((b) => (
            <label key={b.id} className="flex items-center gap-3 rounded-xl border border-line-strong px-4 py-3 text-sm has-[:checked]:border-gold/60 has-[:checked]:bg-gold/10">
              <input type="checkbox" name="barber_ids" value={b.id} defaultChecked={isNew ? b.active : selected.includes(b.id)} className="size-5 accent-[var(--color-gold)]" />
              {b.name}
              {!b.active && <span className="text-xs text-subtle">(inactivo)</span>}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={service?.active ?? true} className="size-5 accent-[var(--color-gold)]" />
        Activo (se puede reservar)
      </label>
      <FormMessage state={state} />
      <SubmitButton>{isNew ? "Crear servicio" : "Guardar cambios"}</SubmitButton>
    </form>
  );
}
