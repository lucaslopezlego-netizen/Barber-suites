import type { WorkingBlock } from "@/lib/availability";
import type { WeeklyHours } from "@/lib/public-data";
import { formatRangeShort, timeToMinutes, WEEKDAY_NAMES } from "@/lib/tz";

// Lunes primero, domingo al final
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Props {
  hours: WeeklyHours[];
  barbers: { id: string; name: string }[];
  workingHours: WorkingBlock[];
  todayWeekday: number;
}

/** Horario de la semana: cada día se despliega para mostrar quién atiende y en qué horas. */
export function WeekSchedule({ hours, barbers, workingHours, todayWeekday }: Props) {
  return (
    <div className="card overflow-hidden">
      {WEEK_ORDER.map((wd) => {
        const day = hours.find((h) => h.weekday === wd);
        const isToday = wd === todayWeekday;
        const team = barbers
          .map((b) => ({
            name: b.name,
            blocks: workingHours
              .filter((w) => w.barber_id === b.id && w.weekday === wd)
              .sort((a, c) => timeToMinutes(a.start_time) - timeToMinutes(c.start_time)),
          }))
          .filter((b) => b.blocks.length > 0);
        const range = day?.open && day.close ? formatRangeShort(day.open, day.close) : hours.length ? "Cerrado" : "Por confirmar";
        const dayName = (
          <span className="flex items-baseline gap-2.5">
            <span className={`title-display text-[0.95rem] ${isToday ? "text-onyx" : "text-fg"}`}>{WEEKDAY_NAMES[wd]}</span>
            {isToday && <span className="text-xs font-semibold text-gold">hoy</span>}
          </span>
        );

        if (team.length === 0) {
          return (
            <div key={wd} className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0">
              {dayName}
              <span className="pr-8 text-sm text-subtle">{range}</span>
            </div>
          );
        }

        return (
          <details key={wd} open={isToday} className="day group border-b border-line last:border-b-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              {dayName}
              <span className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-fg">{range}</span>
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className="size-5 shrink-0 text-subtle transition-transform duration-300 group-open:rotate-180"
                >
                  <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </summary>
            <ul className="mx-5 mb-4 border-l-2 border-onyx pl-4">
              {team.map((b) => (
                <li key={b.name} className="flex flex-col gap-0.5 py-1.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="font-medium text-fg">{b.name}</span>
                  <span className="tabular-nums text-muted">
                    {b.blocks.map((x) => formatRangeShort(x.start_time, x.end_time)).join(" y ")}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
