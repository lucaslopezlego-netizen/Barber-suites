"use client";

import { Check, CheckCheck, Loader2, UserX, X } from "lucide-react";
import { useState, useTransition } from "react";
import { setBookingStatus } from "@/app/admin/actions";
import type { BookingStatus } from "@/lib/admin/types";

const ACTIONS: { status: BookingStatus; label: string; icon: typeof Check; style: string; confirm?: string }[] = [
  { status: "confirmada", label: "Confirmar", icon: Check, style: "border-info/40 text-info hover:bg-info/10" },
  { status: "completada", label: "Completada", icon: CheckCheck, style: "border-ok/40 text-ok hover:bg-ok/10" },
  { status: "no_asistio", label: "No vino", icon: UserX, style: "border-danger/40 text-danger hover:bg-danger/10" },
  {
    status: "cancelada",
    label: "Cancelar",
    icon: X,
    style: "border-line-strong text-muted hover:bg-panel-2",
    confirm: "¿Cancelar esta cita? El turno quedará libre para otros clientes.",
  },
];

/** Botones para cambiar el estado de una cita. Muestra solo los que tienen sentido. */
export function StatusActions({ id, status, isPast }: { id: string; status: BookingStatus; isPast: boolean }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<BookingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = ACTIONS.filter((a) => {
    if (a.status === status) return false;
    if (status === "cancelada") return a.status === "confirmada"; // reactivar
    if (a.status === "confirmada") return status === "pendiente";
    if (a.status === "completada" || a.status === "no_asistio") return isPast || status === "confirmada";
    return status !== "completada" && status !== "no_asistio";
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {visible.map((a) => (
          <button
            key={a.status}
            type="button"
            disabled={pending}
            onClick={() => {
              if (a.confirm && !window.confirm(a.confirm)) return;
              setBusy(a.status);
              setError(null);
              start(async () => {
                const res = await setBookingStatus(id, a.status);
                if (!res.ok) setError(res.message);
                setBusy(null);
              });
            }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${a.style}`}
          >
            {pending && busy === a.status ? <Loader2 className="size-3.5 animate-spin" /> : <a.icon className="size-3.5" />}
            {status === "cancelada" && a.status === "confirmada" ? "Reactivar" : a.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
