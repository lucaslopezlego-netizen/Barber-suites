// Cálculo de turnos libres. Lógica pura (sin red ni base de datos) para poder
// probarla a fondo. Recibe el "snapshot" que devuelve la función SQL
// get_schedule_snapshot() y aplica las mismas reglas que create_booking_public():
//   horario laboral − bloqueos − citas existentes (con margen), partido en turnos
//   según el intervalo de ajustes y la duración del servicio, respetando la
//   anticipación mínima y los días máximos hacia adelante.

import { addDays, diffDays, timeToMinutes, todayIn, weekdayOf, zonedToUtc } from "./tz";

export interface ScheduleSettings {
  slot_interval_min: number;
  min_notice_min: number;
  max_days_ahead: number;
  buffer_min: number;
  timezone: string;
}

export interface SnapshotService {
  id: string;
  name: string;
  description?: string | null;
  duration_min: number;
  price_usd: number;
}

export interface SnapshotBarber {
  id: string;
  name: string;
  photo_url?: string | null;
  bio?: string | null;
  service_ids: string[];
}

export interface WorkingBlock {
  barber_id: string;
  weekday: number;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
}

export interface TimeRange {
  barber_id: string | null; // null en time_off = toda la barbería
  starts_at: string;
  ends_at: string;
}

export interface ScheduleSnapshot {
  settings: ScheduleSettings;
  services: SnapshotService[];
  barbers: SnapshotBarber[];
  working_hours: WorkingBlock[];
  time_off: TimeRange[];
  busy: TimeRange[];
}

export interface Slot {
  /** Inicio del turno en ISO (UTC). */
  start: string;
  /** Hora local 'HH:MM'. */
  time: string;
  /** Barberos libres en ese turno, en el orden de aparición. */
  barberIds: string[];
}

export const ANY_BARBER = "any";

const MIN = 60_000;

interface Interval {
  start: number;
  end: number;
}

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

/** Barberos candidatos: uno concreto o todos los que hacen el servicio. */
export function candidateBarbers(snapshot: ScheduleSnapshot, serviceId: string, barberId: string): SnapshotBarber[] {
  const offering = snapshot.barbers.filter((b) => b.service_ids.includes(serviceId));
  if (barberId === ANY_BARBER) return offering;
  return offering.filter((b) => b.id === barberId);
}

/** ¿La fecha está dentro de la ventana reservable (hoy … hoy + max_days_ahead)? */
export function isDateInWindow(date: string, settings: ScheduleSettings, now: Date): boolean {
  const today = todayIn(settings.timezone, now);
  const diff = diffDays(today, date);
  return diff >= 0 && diff <= settings.max_days_ahead;
}

/** Turnos libres de un barbero en una fecha local. */
function barberSlotsForDate(
  snapshot: ScheduleSnapshot,
  barberId: string,
  durationMin: number,
  date: string,
  now: Date,
): { start: number; time: string }[] {
  const { settings } = snapshot;
  const tz = settings.timezone;
  const weekday = weekdayOf(date);
  const earliest = now.getTime() + settings.min_notice_min * MIN;
  const step = settings.slot_interval_min;

  const blocks = snapshot.working_hours
    .filter((w) => w.barber_id === barberId && w.weekday === weekday)
    .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
  if (blocks.length === 0) return [];

  const timeOff: Interval[] = snapshot.time_off
    .filter((t) => t.barber_id === null || t.barber_id === barberId)
    .map((t) => ({ start: Date.parse(t.starts_at), end: Date.parse(t.ends_at) }));

  const busy: Interval[] = snapshot.busy
    .filter((b) => b.barber_id === barberId)
    .map((b) => ({ start: Date.parse(b.starts_at), end: Date.parse(b.ends_at) }));

  const result: { start: number; time: string }[] = [];
  for (const block of blocks) {
    const blockStartMin = timeToMinutes(block.start_time);
    const blockEndMin = timeToMinutes(block.end_time);
    for (let m = blockStartMin; m + durationMin <= blockEndMin; m += step) {
      const time = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const start = zonedToUtc(date, time, tz).getTime();
      if (start < earliest) continue;
      const service: Interval = { start, end: start + durationMin * MIN };
      // La cita nueva ocupa también el margen posterior (igual que blocked_until en SQL)
      const withBuffer: Interval = { start, end: service.end + settings.buffer_min * MIN };
      if (timeOff.some((t) => overlaps(service, t))) continue;
      if (busy.some((b) => overlaps(withBuffer, b))) continue;
      result.push({ start, time });
    }
  }
  return result;
}

/**
 * Turnos libres para un servicio en una fecha local. `barberId` puede ser un id
 * o ANY_BARBER ("Cualquier barbero disponible"): en ese caso se unen los turnos
 * de todos los barberos que hacen el servicio.
 */
export function getSlotsForDate(params: {
  snapshot: ScheduleSnapshot;
  serviceId: string;
  barberId: string;
  date: string;
  now?: Date;
}): Slot[] {
  const { snapshot, serviceId, barberId, date } = params;
  const now = params.now ?? new Date();
  const service = snapshot.services.find((s) => s.id === serviceId);
  if (!service) return [];
  if (!isDateInWindow(date, snapshot.settings, now)) return [];

  const byStart = new Map<number, Slot>();
  for (const barber of candidateBarbers(snapshot, serviceId, barberId)) {
    for (const s of barberSlotsForDate(snapshot, barber.id, service.duration_min, date, now)) {
      const existing = byStart.get(s.start);
      if (existing) existing.barberIds.push(barber.id);
      else byStart.set(s.start, { start: new Date(s.start).toISOString(), time: s.time, barberIds: [barber.id] });
    }
  }
  return [...byStart.entries()].sort((a, b) => a[0] - b[0]).map(([, slot]) => slot);
}

/** Número de turnos libres por día, desde `from` durante `days` días. */
export function getDaysAvailability(params: {
  snapshot: ScheduleSnapshot;
  serviceId: string;
  barberId: string;
  from: string;
  days: number;
  now?: Date;
}): { date: string; slots: number }[] {
  const out: { date: string; slots: number }[] = [];
  for (let i = 0; i < params.days; i++) {
    const date = addDays(params.from, i);
    out.push({ date, slots: getSlotsForDate({ ...params, date }).length });
  }
  return out;
}

/**
 * Para "Cualquier barbero": ordena los barberos libres en un turno poniendo
 * primero al que tiene menos citas ese día (reparte el trabajo).
 */
export function rankBarbersForSlot(snapshot: ScheduleSnapshot, barberIds: string[], date: string): string[] {
  const tz = snapshot.settings.timezone;
  const dayStart = zonedToUtc(date, "00:00", tz).getTime();
  const dayEnd = zonedToUtc(addDays(date, 1), "00:00", tz).getTime();
  const load = (id: string) =>
    snapshot.busy.filter((b) => b.barber_id === id && Date.parse(b.starts_at) >= dayStart && Date.parse(b.starts_at) < dayEnd)
      .length;
  const order = new Map(snapshot.barbers.map((b, i) => [b.id, i]));
  return [...barberIds].sort((a, b) => load(a) - load(b) || (order.get(a) ?? 0) - (order.get(b) ?? 0));
}
