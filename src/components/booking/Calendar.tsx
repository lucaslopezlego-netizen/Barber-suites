"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { addDays, MONTH_NAMES, weekdayOf } from "@/lib/tz";

const HEAD = ["L", "M", "M", "J", "V", "S", "D"];

interface Props {
  today: string;
  lastDay: string;
  /** turnos libres por fecha; undefined = cargando */
  availability?: Record<string, number>;
  selected: string | null;
  onSelect: (date: string) => void;
}

/** Calendario mensual (semana de lunes a domingo). Los días sin turnos quedan deshabilitados. */
export function Calendar({ today, lastDay, availability, selected, onSelect }: Props) {
  const firstMonth = today.slice(0, 7);
  const lastMonth = lastDay.slice(0, 7);
  const [month, setMonth] = useState((selected ?? today).slice(0, 7));

  const cells = useMemo(() => {
    const first = `${month}-01`;
    const offset = (weekdayOf(first) + 6) % 7; // lunes = 0
    const out: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = first; d.startsWith(month); d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  const [y, m] = month.split("-").map(Number);
  const shift = (delta: number) => {
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(dt.toISOString().slice(0, 7));
  };
  const loading = availability === undefined;

  return (
    <div className="card p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={month <= firstMonth}
          className="grid size-10 place-items-center rounded-full text-cream transition hover:bg-panel-2 disabled:opacity-25"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="font-semibold capitalize" aria-live="polite">
          {MONTH_NAMES[m - 1]} {y}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={month >= lastMonth}
          className="grid size-10 place-items-center rounded-full text-cream transition hover:bg-panel-2 disabled:opacity-25"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-subtle" aria-hidden="true">
        {HEAD.map((h, i) => (
          <span key={i} className="py-1">
            {h}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1" role="grid">
        {cells.map((date, i) => {
          if (!date) return <span key={`e${i}`} />;
          const inRange = date >= today && date <= lastDay;
          const slots = availability?.[date] ?? 0;
          const enabled = inRange && !loading && slots > 0;
          const isSelected = date === selected;
          const day = Number(date.slice(8));
          return (
            <button
              key={date}
              type="button"
              disabled={!enabled}
              onClick={() => onSelect(date)}
              aria-pressed={isSelected}
              aria-label={`${day} de ${MONTH_NAMES[m - 1]}${enabled ? `, ${slots} turnos libres` : ", sin disponibilidad"}`}
              className={[
                "relative grid aspect-square place-items-center rounded-xl text-[15px] font-semibold transition",
                isSelected
                  ? "bg-gold text-ink shadow-[0_6px_20px_-8px_rgb(201_164_92/0.8)]"
                  : enabled
                    ? "text-cream hover:bg-panel-2 hover:ring-1 hover:ring-gold/40"
                    : "text-subtle/50 line-through decoration-subtle/40",
                loading && inRange ? "animate-pulse bg-panel-2/60" : "",
              ].join(" ")}
            >
              {day}
              {enabled && !isSelected && <span className="absolute bottom-1.5 size-1 rounded-full bg-gold" />}
              {date === today && !isSelected && (
                <span className="absolute top-0.5 text-[10px] font-medium text-gold no-underline">hoy</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
