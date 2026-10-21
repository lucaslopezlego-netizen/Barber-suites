// Utilidades de fecha/hora en una zona horaria IANA concreta, sin dependencias.
// Las fechas "locales" se manejan como strings 'YYYY-MM-DD' y las horas como
// 'HH:MM' para evitar ambigüedades con la zona del navegador o del servidor.

export const DEFAULT_TZ = "America/Caracas";

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let f = partsFormatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsFormatterCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface ZonedParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  weekday: number; // 0 = domingo
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** Descompone un instante en fecha/hora de la zona `tz`. */
export function toZonedParts(instant: Date | string | number, tz: string = DEFAULT_TZ): ZonedParts {
  const d = instant instanceof Date ? instant : new Date(instant);
  const p: Record<string, string> = {};
  for (const part of partsFormatter(tz).formatToParts(d)) p[part.type] = part.value;
  const year = Number(p.year);
  const month = Number(p.month);
  const day = Number(p.day);
  const hour = Number(p.hour);
  const minute = Number(p.minute);
  const second = Number(p.second);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    weekday: WEEKDAYS[p.weekday],
    year,
    month,
    day,
    hour,
    minute,
    second,
  };
}

/** Diferencia (ms) entre la hora local de `tz` y UTC en ese instante. */
export function tzOffsetMs(instant: Date, tz: string = DEFAULT_TZ): number {
  const p = toZonedParts(instant, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Convierte fecha 'YYYY-MM-DD' + hora 'HH:MM' de la zona `tz` a un Date (UTC). */
export function zonedToUtc(date: string, time: string, tz: string = DEFAULT_TZ): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Dos pasadas para cubrir zonas con cambio de horario (Caracas no lo tiene).
  let ts = guess - tzOffsetMs(new Date(guess), tz);
  ts = guess - tzOffsetMs(new Date(ts), tz);
  return new Date(ts);
}

/** Fecha local de hoy en la zona `tz`. */
export function todayIn(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  return toZonedParts(now, tz).date;
}

/** Suma días a una fecha 'YYYY-MM-DD' (aritmética de calendario pura). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Día de la semana (0 = domingo) de una fecha 'YYYY-MM-DD'. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Diferencia en días de calendario entre dos fechas 'YYYY-MM-DD' (b - a). */
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** 'HH:MM' → minutos desde medianoche. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** minutos desde medianoche → 'HH:MM'. */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Formato en español
// ---------------------------------------------------------------------------

export const WEEKDAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "9:30 a. m." a partir de 'HH:MM'. */
export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Hora local de un instante: "9:30 a. m.". */
export function formatInstantTime(instant: Date | string, tz: string = DEFAULT_TZ): string {
  return formatTime12(toZonedParts(instant, tz).time);
}

/** "martes 4 de noviembre" a partir de 'YYYY-MM-DD'. */
export function formatDateLong(date: string, withYear = false): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = `${WEEKDAY_NAMES[weekdayOf(date)].toLowerCase()} ${d} de ${MONTH_NAMES[m - 1]}`;
  return withYear ? `${base} de ${y}` : base;
}

/** "mar 4 nov" a partir de 'YYYY-MM-DD'. */
export function formatDateShort(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${WEEKDAY_SHORT[weekdayOf(date)].toLowerCase()} ${d} ${MONTH_NAMES[m - 1].slice(0, 3)}`;
}

/** "9 a. m." o "9:30 a. m." (sin ":00") para tablas compactas. */
export function formatTimeShort(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

/** "9 a. m. a 1 p. m." */
export function formatRangeShort(start: string, end: string): string {
  return `${formatTimeShort(start)} a ${formatTimeShort(end)}`;
}

/** Minutos totales de una lista de bloques 'HH:MM'. */
export function blocksMinutes(blocks: { start_time: string; end_time: string }[]): number {
  return blocks.reduce((sum, b) => sum + timeToMinutes(b.end_time) - timeToMinutes(b.start_time), 0);
}

/** 2400 → "40 h", 2430 → "40 h 30 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
