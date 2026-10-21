"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/admin/actions";
import { FormMessage, SubmitButton } from "@/components/admin/ui";
import { formatPhone } from "@/lib/phone";

interface Settings {
  slot_interval_min: number;
  min_notice_min: number;
  max_days_ahead: number;
  buffer_min: number;
  whatsapp: string;
  address: string;
  instagram: string | null;
}

const withCurrent = (options: [number, string][], current: number) =>
  options.some(([v]) => v === current) ? options : [...options, [current, `${current} min`] as [number, string]].sort((a, b) => a[0] - b[0]);

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState(saveSettings, null);
  return (
    <form action={action} className="max-w-xl space-y-6">
      <section className="card space-y-5 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Reservas</h2>
        <Select
          name="slot_interval_min"
          label="Cada cuánto empiezan los turnos"
          help="Con 15 min, los clientes ven 9:00, 9:15, 9:30…"
          value={settings.slot_interval_min}
          options={withCurrent([[10, "Cada 10 min"], [15, "Cada 15 min"], [20, "Cada 20 min"], [30, "Cada 30 min"], [60, "Cada hora"]], settings.slot_interval_min)}
        />
        <Select
          name="min_notice_min"
          label="Anticipación mínima para reservar"
          help="Evita reservas de último minuto que no alcanzas a ver."
          value={settings.min_notice_min}
          options={withCurrent(
            [[0, "Sin mínimo"], [30, "30 minutos"], [60, "1 hora"], [120, "2 horas"], [180, "3 horas"], [720, "12 horas"], [1440, "1 día"]],
            settings.min_notice_min,
          )}
        />
        <div>
          <label htmlFor="max_days_ahead" className="label">
            Hasta cuántos días adelante se puede reservar
          </label>
          <input id="max_days_ahead" name="max_days_ahead" type="number" min={1} max={60} required defaultValue={settings.max_days_ahead} className="field" />
          <p className="mt-1 text-xs text-subtle">Entre 1 y 60 días.</p>
        </div>
        <Select
          name="buffer_min"
          label="Margen entre citas"
          help="Tiempo libre después de cada cita para limpiar y preparar."
          value={settings.buffer_min}
          options={withCurrent([[0, "Sin margen"], [5, "5 min"], [10, "10 min"], [15, "15 min"], [20, "20 min"], [30, "30 min"]], settings.buffer_min)}
        />
      </section>

      <section className="card space-y-5 p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Contacto (se ve en la web)</h2>
        <div>
          <label htmlFor="whatsapp" className="label">
            WhatsApp de la barbería
          </label>
          <input id="whatsapp" name="whatsapp" type="tel" required defaultValue={formatPhone(settings.whatsapp)} className="field" />
        </div>
        <div>
          <label htmlFor="address" className="label">
            Dirección
          </label>
          <input id="address" name="address" required defaultValue={settings.address} className="field" />
        </div>
        <div>
          <label htmlFor="instagram" className="label">
            Instagram
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">@</span>
            <input id="instagram" name="instagram" defaultValue={settings.instagram ?? ""} className="field !pl-9" />
          </div>
        </div>
      </section>

      <FormMessage state={state} />
      <SubmitButton>Guardar ajustes</SubmitButton>
    </form>
  );
}

function Select({ name, label, help, value, options }: { name: string; label: string; help?: string; value: number; options: [number, string][] }) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <select id={name} name={name} defaultValue={value} className="field">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      {help && <p className="mt-1 text-xs text-subtle">{help}</p>}
    </div>
  );
}
