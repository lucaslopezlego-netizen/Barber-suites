"use client";

import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/admin/types";

/** Interruptor activo/inactivo que llama a una acción del servidor. */
export function ActiveToggle({ active, onToggle, label }: { active: boolean; onToggle: (next: boolean) => Promise<ActionResult>; label: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={label}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await onToggle(!active);
            setMsg(r.ok ? null : r.message);
          })
        }
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${active ? "bg-onyx" : "bg-line-strong"} disabled:opacity-60`}
      >
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${active ? "left-6" : "left-1"}`} />
      </button>
      <span className="w-14 text-xs text-muted">{pending ? <Loader2 className="size-3.5 animate-spin" /> : active ? "Activo" : "Inactivo"}</span>
      {msg && <span className="text-xs text-danger">{msg}</span>}
    </div>
  );
}

/** Flechas para subir/bajar en el orden de aparición. */
export function MoveButtons({ onMove, first, last }: { onMove: (dir: "up" | "down") => Promise<ActionResult>; first: boolean; last: boolean }) {
  const [pending, start] = useTransition();
  const btn = "grid size-9 place-items-center rounded-full border border-line-strong text-muted hover:text-fg disabled:opacity-25";
  return (
    <div className="flex gap-1">
      <button type="button" className={btn} disabled={first || pending} onClick={() => start(async () => void (await onMove("up")))} aria-label="Subir">
        <ArrowUp className="size-4" />
      </button>
      <button type="button" className={btn} disabled={last || pending} onClick={() => start(async () => void (await onMove("down")))} aria-label="Bajar">
        <ArrowDown className="size-4" />
      </button>
    </div>
  );
}
