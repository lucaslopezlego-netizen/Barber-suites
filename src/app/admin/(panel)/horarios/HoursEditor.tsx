"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { saveWorkingHours, type HourBlock } from "@/app/admin/actions";
import { FormMessage } from "@/components/admin/ui";
import type { ActionResult } from "@/lib/admin/types";
import { timeToMinutes, WEEKDAY_NAMES } from "@/lib/tz";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes → domingo
type Block = { start: string; end: string };

function validateDay(blocks: Block[]): string | null {
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].start || !sorted[i].end) return "Completa las horas";
    if (timeToMinutes(sorted[i].start) >= timeToMinutes(sorted[i].end)) return "El inicio debe ser antes del fin";
    if (i > 0 && timeToMinutes(sorted[i].start) < timeToMinutes(sorted[i - 1].end)) return "Hay bloques que se cruzan";
  }
  return null;
}

export function HoursEditor({ barberId, barberName, initial }: { barberId: string; barberName: string; initial: HourBlock[] }) {
  const [week, setWeek] = useState<Record<number, Block[]>>(() => {
    const w: Record<number, Block[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
    for (const h of initial) w[h.weekday].push({ start: h.start_time, end: h.end_time });
    return w;
  });
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const errors = useMemo(() => Object.fromEntries(ORDER.map((d) => [d, validateDay(week[d])])), [week]);
  const hasErrors = Object.values(errors).some(Boolean);

  const update = (day: number, blocks: Block[]) => {
    setWeek((w) => ({ ...w, [day]: blocks }));
    setDirty(true);
    setResult(null);
  };

  const copyToAll = (day: number) => {
    if (!window.confirm(`¿Copiar el horario del ${WEEKDAY_NAMES[day].toLowerCase()} a todos los días que trabaja?`)) return;
    setWeek((w) => {
      const next = { ...w };
      for (const d of ORDER) if (d !== day && w[d].length > 0) next[d] = w[day].map((b) => ({ ...b }));
      return next;
    });
    setDirty(true);
  };

  const save = () =>
    start(async () => {
      const blocks: HourBlock[] = ORDER.flatMap((d) => week[d].map((b) => ({ weekday: d, start_time: b.start, end_time: b.end })));
      const r = await saveWorkingHours(barberId, blocks);
      setResult(r);
      if (r.ok) setDirty(false);
    });

  return (
    <div className="space-y-3">
      {ORDER.map((day) => {
        const blocks = week[day];
        const works = blocks.length > 0;
        return (
          <section key={day} className={`card p-4 ${works ? "" : "bg-panel/50"}`}>
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={works}
                  aria-label={`${barberName} trabaja el ${WEEKDAY_NAMES[day]}`}
                  onClick={() => update(day, works ? [] : [{ start: "09:00", end: "18:00" }])}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${works ? "bg-gold" : "bg-line-strong"}`}
                >
                  <span className={`absolute top-1 size-5 rounded-full bg-cream shadow transition-all ${works ? "left-6" : "left-1"}`} />
                </button>
                <span className="font-semibold">{WEEKDAY_NAMES[day]}</span>
              </label>
              {works ? (
                <button type="button" onClick={() => copyToAll(day)} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-gold">
                  <Copy className="size-3.5" /> Copiar a los demás
                </button>
              ) : (
                <span className="text-sm text-subtle">No trabaja</span>
              )}
            </div>

            {works && (
              <div className="mt-4 space-y-2">
                {blocks.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5 sm:gap-2">
                    <input
                      type="time"
                      step={300}
                      aria-label="Desde"
                      value={b.start}
                      onChange={(e) => update(day, blocks.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                      className="field !w-auto min-w-0 flex-1 !px-3 !py-2.5 tabular-nums"
                    />
                    <span className="text-subtle">a</span>
                    <input
                      type="time"
                      step={300}
                      aria-label="Hasta"
                      value={b.end}
                      onChange={(e) => update(day, blocks.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                      className="field !w-auto min-w-0 flex-1 !px-3 !py-2.5 tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => update(day, blocks.filter((_, j) => j !== i))}
                      className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-panel-2 hover:text-danger"
                      aria-label="Quitar bloque"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const last = blocks[blocks.length - 1];
                    const startM = Math.min(timeToMinutes(last?.end ?? "13:00") + 60, 22 * 60);
                    const s = `${String(Math.floor(startM / 60)).padStart(2, "0")}:${String(startM % 60).padStart(2, "0")}`;
                    const e = `${String(Math.min(Math.floor(startM / 60) + 4, 23)).padStart(2, "0")}:00`;
                    update(day, [...blocks, { start: s, end: e }]);
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-gold hover:text-gold-soft"
                >
                  <Plus className="size-4" /> Agregar otro bloque (p. ej. después del almuerzo)
                </button>
                {errors[day] && <p className="text-sm text-danger">{errors[day]}</p>}
              </div>
            )}
          </section>
        );
      })}

      <div className={`${dirty ? "sticky bottom-20 lg:bottom-4" : ""} z-10 space-y-3 rounded-2xl border border-line bg-ink/95 p-4 backdrop-blur`}>
        <FormMessage state={result} />
        <button type="button" onClick={save} disabled={pending || hasErrors || !dirty} className="btn-gold w-full">
          {pending ? "Guardando…" : dirty ? `Guardar horario de ${barberName}` : "Sin cambios"}
        </button>
      </div>
    </div>
  );
}
