"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createTimeOff, deleteTimeOff } from "@/app/admin/actions";
import { FormMessage, SubmitButton } from "@/components/admin/ui";

export function TimeOffForm({ barbers, defaultDate }: { barbers: { id: string; name: string }[]; defaultDate: string }) {
  const [state, action] = useActionState(createTimeOff, null);
  const [kind, setKind] = useState<"days" | "hours">("days");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card h-fit space-y-5 p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Nuevo bloqueo</h2>
      <div>
        <label htmlFor="barber_id" className="label">
          ¿Para quién?
        </label>
        <select id="barber_id" name="barber_id" className="field" defaultValue={barbers[0]?.id ?? "all"}>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
          <option value="all">Toda la barbería (feriado / cierre)</option>
        </select>
      </div>
      <fieldset>
        <legend className="label">Tipo</legend>
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line-strong p-1 text-sm">
          {(
            [
              ["days", "Día(s) completo(s)"],
              ["hours", "Unas horas"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className={`cursor-pointer rounded-xl px-3 py-2.5 text-center font-medium ${kind === v ? "bg-gold text-ink" : "text-muted"}`}>
              <input type="radio" name="kind" value={v} checked={kind === v} onChange={() => setKind(v)} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "days" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="from_date" className="label">
              Desde
            </label>
            <input id="from_date" name="from_date" type="date" required defaultValue={defaultDate} className="field" />
          </div>
          <div>
            <label htmlFor="to_date" className="label">
              Hasta (incluido)
            </label>
            <input id="to_date" name="to_date" type="date" defaultValue={defaultDate} className="field" />
          </div>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="date" className="label">
              Fecha
            </label>
            <input id="date" name="date" type="date" required defaultValue={defaultDate} className="field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="from_time" className="label">
                Desde
              </label>
              <input id="from_time" name="from_time" type="time" step={300} required defaultValue="12:00" className="field" />
            </div>
            <div>
              <label htmlFor="to_time" className="label">
                Hasta
              </label>
              <input id="to_time" name="to_time" type="time" step={300} required defaultValue="14:00" className="field" />
            </div>
          </div>
        </>
      )}
      <div>
        <label htmlFor="reason" className="label">
          Motivo <span className="font-normal text-subtle">(opcional, solo lo ves tú)</span>
        </label>
        <input id="reason" name="reason" maxLength={140} placeholder="Ej.: vacaciones, médico, feriado" className="field" />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-gold w-full">Bloquear</SubmitButton>
    </form>
  );
}

export function DeleteTimeOff({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Eliminar bloqueo"
      onClick={() => {
        if (window.confirm("¿Eliminar este bloqueo? Ese horario volverá a estar disponible para reservas.")) start(async () => void (await deleteTimeOff(id)));
      }}
      className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-danger"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
