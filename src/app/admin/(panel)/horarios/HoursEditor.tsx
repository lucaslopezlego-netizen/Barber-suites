"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { saveWorkingHours, type HourBlock } from "@/app/admin/actions";
import { FormMessage } from "@/components/admin/ui";
import type { ActionResult } from "@/lib/admin/types";
import { formatDuration, minutesToTime, timeToMinutes, WEEKDAY_NAMES, WEEKDAY_SHORT } from "@/lib/tz";

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // lunes → domingo
type Block = { start: string; end: string };
type Week = Record<number, Block[]>;

// Horarios típicos para llenar varios días de una vez
const TEMPLATES: { id: string; label: string; blocks: Block[] }[] = [
  { id: "corrido", label: "Corrido, 9 a 6", blocks: [{ start: "09:00", end: "18:00" }] },
  {
    id: "almuerzo",
    label: "Con almuerzo, 9 a 1 y 2 a 6",
    blocks: [
      { start: "09:00", end: "13:00" },
      { start: "14:00", end: "18:00" },
    ],
  },
  { id: "manana", label: "Solo mañana, 9 a 1", blocks: [{ start: "09:00", end: "13:00" }] },
  { id: "tarde", label: "Solo tarde, 2 a 7", blocks: [{ start: "14:00", end: "19:00" }] },
  { id: "libre", label: "No trabaja", blocks: [] },
];

function toWeek(initial: HourBlock[]): Week {
  const w: Week = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const h of initial) w[h.weekday].push({ start: h.start_time, end: h.end_time });
  return w;
}

function sortBlocks(blocks: Block[]) {
  return [...blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

function validateDay(blocks: Block[]): string | null {
  const sorted = sortBlocks(blocks);
  for (let i = 0; i < sorted.length; i++) {
    if (!sorted[i].start || !sorted[i].end) return "Completa las horas.";
    if (timeToMinutes(sorted[i].start) >= timeToMinutes(sorted[i].end)) return "La hora de inicio debe ser antes que la de fin.";
    if (i > 0 && timeToMinutes(sorted[i].start) < timeToMinutes(sorted[i - 1].end)) return "Hay dos bloques que se cruzan.";
  }
  return null;
}

const dayMinutes = (blocks: Block[]) =>
  validateDay(blocks) ? 0 : blocks.reduce((s, b) => s + timeToMinutes(b.end) - timeToMinutes(b.start), 0);

export function HoursEditor({ barberId, barberName, initial }: { barberId: string; barberName: string; initial: HourBlock[] }) {
  const [saved, setSaved] = useState<Week>(() => toWeek(initial));
  const [week, setWeek] = useState<Week>(() => toWeek(initial));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  // Aplicar a varios días
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [template, setTemplate] = useState(TEMPLATES[1].id);

  const dirty = useMemo(() => JSON.stringify(week) !== JSON.stringify(saved), [week, saved]);
  const errors = useMemo(() => Object.fromEntries(ORDER.map((d) => [d, validateDay(week[d])])), [week]);
  const hasErrors = Object.values(errors).some(Boolean);
  const total = ORDER.reduce((s, d) => s + dayMinutes(week[d]), 0);
  const workingDays = ORDER.filter((d) => week[d].length > 0).length;

  const update = (day: number, blocks: Block[]) => {
    setWeek((w) => ({ ...w, [day]: blocks }));
    setResult(null);
  };

  const applyTemplate = () => {
    const t = TEMPLATES.find((x) => x.id === template)!;
    setWeek((w) => {
      const next = { ...w };
      for (const d of days) next[d] = t.blocks.map((b) => ({ ...b }));
      return next;
    });
    setResult(null);
  };

  const save = () =>
    start(async () => {
      const clean: Week = Object.fromEntries(ORDER.map((d) => [d, sortBlocks(week[d])]));
      const blocks: HourBlock[] = ORDER.flatMap((d) => clean[d].map((b) => ({ weekday: d, start_time: b.start, end_time: b.end })));
      const r = await saveWorkingHours(barberId, blocks);
      setResult(r);
      if (r.ok) {
        setWeek(clean);
        setSaved(clean);
      }
    });

  const toggleDay = (d: number) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  return (
    <div className="space-y-6">
      {/* Paso 1: llenar varios días de una vez */}
      <section className="card p-4 sm:p-5" aria-labelledby="aplicar-title">
        <h3 id="aplicar-title" className="font-semibold">
          Aplicar un horario a varios días
        </h3>
        <p className="mt-0.5 text-sm text-muted">Elige los días y el horario. Después puedes ajustar cada día abajo.</p>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium">Días</legend>
          <div className="flex flex-wrap gap-2">
            {ORDER.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_NAMES[d]}
                  onClick={() => toggleDay(d)}
                  className={`h-10 w-12 rounded-xl border text-sm font-semibold transition ${
                    on ? "border-onyx bg-onyx text-white" : "border-line-strong bg-page text-muted hover:border-onyx"
                  }`}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex gap-3 text-xs">
            <button type="button" className="text-gold hover:text-gold-strong" onClick={() => setDays([1, 2, 3, 4, 5])}>
              Lunes a viernes
            </button>
            <button type="button" className="text-gold hover:text-gold-strong" onClick={() => setDays([1, 2, 3, 4, 5, 6])}>
              Lunes a sábado
            </button>
            <button type="button" className="text-gold hover:text-gold-strong" onClick={() => setDays([...ORDER])}>
              Todos
            </button>
          </div>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium">Horario</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-strong px-4 py-3 text-sm has-[:checked]:border-onyx has-[:checked]:bg-surface"
              >
                <input
                  type="radio"
                  name="plantilla"
                  value={t.id}
                  checked={template === t.id}
                  onChange={() => setTemplate(t.id)}
                  className="size-4 accent-[var(--color-onyx)]"
                />
                {t.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="button" onClick={applyTemplate} disabled={days.length === 0} className="btn-secondary mt-4 w-full sm:w-auto">
          Aplicar a {days.length} {days.length === 1 ? "día" : "días"}
        </button>
      </section>

      {/* Paso 2: ajuste día por día */}
      <section aria-labelledby="dias-title">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 id="dias-title" className="font-semibold">
            Día por día
          </h3>
          <p className="text-sm text-muted">
            {workingDays} {workingDays === 1 ? "día" : "días"}, {formatDuration(total)} a la semana
          </p>
        </div>
        <ul className="card divide-y divide-line">
          {ORDER.map((day) => {
            const blocks = week[day];
            const works = blocks.length > 0;
            return (
              <li key={day} className="grid grid-cols-[minmax(0,1fr)] gap-3 p-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-start">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={works}
                      aria-label={`${barberName} trabaja el ${WEEKDAY_NAMES[day].toLowerCase()}`}
                      onClick={() => update(day, works ? [] : [{ start: "09:00", end: "18:00" }])}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition ${works ? "bg-onyx" : "bg-line-strong"}`}
                    >
                      <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${works ? "left-6" : "left-1"}`} />
                    </button>
                    <span className={`font-semibold ${works ? "text-onyx" : "text-subtle"}`}>{WEEKDAY_NAMES[day]}</span>
                  </div>
                  <span className="text-xs text-subtle tabular-nums sm:pl-15">{works ? formatDuration(dayMinutes(blocks)) : "No trabaja"}</span>
                </div>

                {works && (
                  <div className="space-y-2">
                    {blocks.map((b, i) => (
                      <div key={i} className="flex items-center gap-1.5 sm:gap-2">
                        <input
                          type="time"
                          step={300}
                          aria-label={`${WEEKDAY_NAMES[day]}, bloque ${i + 1}, desde`}
                          value={b.start}
                          onChange={(e) => update(day, blocks.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                          className="field !w-auto min-w-0 flex-1 !px-3 !py-2.5 tabular-nums sm:max-w-40"
                        />
                        <span className="text-subtle">a</span>
                        <input
                          type="time"
                          step={300}
                          aria-label={`${WEEKDAY_NAMES[day]}, bloque ${i + 1}, hasta`}
                          value={b.end}
                          onChange={(e) => update(day, blocks.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                          className="field !w-auto min-w-0 flex-1 !px-3 !py-2.5 tabular-nums sm:max-w-40"
                        />
                        <button
                          type="button"
                          onClick={() => update(day, blocks.filter((_, j) => j !== i))}
                          className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-danger"
                          aria-label={`Quitar el bloque ${i + 1} del ${WEEKDAY_NAMES[day].toLowerCase()}`}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    ))}
                    {errors[day] ? (
                      <p role="alert" className="text-sm text-danger">
                        {errors[day]}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const lastEnd = timeToMinutes(sortBlocks(blocks).at(-1)?.end ?? "13:00");
                          const s = Math.min(lastEnd + 60, 22 * 60);
                          update(day, [...blocks, { start: minutesToTime(s), end: minutesToTime(Math.min(s + 180, 23 * 60 + 55)) }]);
                        }}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:text-gold-strong"
                      >
                        <Plus className="size-4" /> Agregar bloque
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Guardar: solo cuando hay cambios */}
      {(dirty || result) && (
        <div className={`${dirty ? "sticky bottom-20 lg:bottom-4" : ""} z-10 space-y-3 rounded-2xl border border-line bg-page/95 p-4 shadow-[0_10px_30px_-15px_rgb(0_0_0/0.3)] backdrop-blur`}>
          <FormMessage state={result} />
          {dirty && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                {hasErrors ? "Corrige los días marcados en rojo para poder guardar." : "Tienes cambios sin guardar."}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWeek(saved);
                    setResult(null);
                  }}
                  disabled={pending}
                  className="btn-secondary flex-1 !py-3 sm:flex-none"
                >
                  Descartar
                </button>
                <button type="button" onClick={save} disabled={pending || hasErrors} className="btn-primary flex-1 !py-3 sm:flex-none">
                  {pending ? "Guardando…" : "Guardar horario"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
