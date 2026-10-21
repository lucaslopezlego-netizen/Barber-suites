import { addDays, DEFAULT_TZ, todayIn, weekdayOf, zonedToUtc } from "@/lib/tz";

/** Lunes de la semana de `date`. */
export function weekStart(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** Rango UTC [inicio del día `from`, inicio del día `toExclusive`) en Caracas. */
export function dayRange(from: string, toExclusive: string) {
  return {
    from: zonedToUtc(from, "00:00", DEFAULT_TZ).toISOString(),
    to: zonedToUtc(toExclusive, "00:00", DEFAULT_TZ).toISOString(),
  };
}

export function today() {
  return todayIn(DEFAULT_TZ);
}

export function isDateParam(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
