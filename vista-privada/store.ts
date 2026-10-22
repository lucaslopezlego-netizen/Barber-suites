// Base de datos en memoria para la vista previa. Reproduce el seed y las reglas
// de create_booking_public() (horario, bloqueos, anticipación, días máximos,
// margen y cero reservas dobles). Nada sale de la pestaña del navegador.
import { useSyncExternalStore } from "react";
import { ANY_BARBER, getDaysAvailability, getSlotsForDate, rankBarbersForSlot, type ScheduleSnapshot } from "@/lib/availability";
import type { BookingStatus } from "@/lib/admin/types";
import { BOOKING_ERRORS } from "@/lib/booking-errors";
import { BUSINESS } from "@/lib/business";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { addDays, DEFAULT_TZ, timeToMinutes, todayIn, toZonedParts } from "@/lib/tz";

export interface Barber {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  active: boolean;
  sort_order: number;
}
export interface Service {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_usd: number;
  active: boolean;
  sort_order: number;
}
export interface WorkingBlock {
  barber_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}
export interface Booking {
  id: string;
  barber_id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  blocked_until: string;
  status: BookingStatus;
  source: "web" | "admin";
  price_usd: number;
  created_at: string;
}

const B1 = "11111111-1111-4111-8111-111111111111";
const B2 = "22222222-2222-4222-8222-222222222222";
const B3 = "33333333-3333-4333-8333-333333333333";
const CORTE = "aaaaaaa1-0000-4000-8000-000000000001";
const FADE = "aaaaaaa2-0000-4000-8000-000000000002";
const BARBA = "aaaaaaa3-0000-4000-8000-000000000003";
const COLOR = "aaaaaaa4-0000-4000-8000-000000000004";

const settings = { slot_interval_min: 15, min_notice_min: 60, max_days_ahead: 30, buffer_min: 0, timezone: DEFAULT_TZ };

const state = {
  barbers: [
    { id: B1, name: "Barbero 1 (ejemplo)", photo_url: null, bio: "Especialista en fades y degradados. Texto de ejemplo.", active: true, sort_order: 1 },
    { id: B2, name: "Barbero 2 (ejemplo)", photo_url: null, bio: "Cortes clásicos y arreglo de barba. Texto de ejemplo.", active: true, sort_order: 2 },
    { id: B3, name: "Barbero 3 (ejemplo)", photo_url: null, bio: "Color, decoloración y estilos modernos. Texto de ejemplo.", active: true, sort_order: 3 },
  ] as Barber[],
  services: [
    { id: CORTE, name: "Corte clásico", description: "Corte a tijera o máquina con acabado y peinado.", duration_min: 30, price_usd: 10, active: true, sort_order: 1 },
    { id: FADE, name: "Fade / degradado", description: "Degradado bajo, medio o alto con perfilado.", duration_min: 45, price_usd: 12, active: true, sort_order: 2 },
    { id: BARBA, name: "Corte + barba", description: "Corte completo más arreglo y perfilado de barba.", duration_min: 60, price_usd: 15, active: true, sort_order: 3 },
    { id: COLOR, name: "Decoloración / color", description: "Platinado, mechas o color. Incluye corte.", duration_min: 120, price_usd: 35, active: true, sort_order: 4 },
  ] as Service[],
  barberServices: [
    [B1, CORTE], [B1, FADE], [B1, BARBA],
    [B2, CORTE], [B2, FADE], [B2, BARBA],
    [B3, CORTE], [B3, FADE], [B3, COLOR],
  ] as [string, string][],
  workingHours: [
    ...[B1, B2].flatMap((b) =>
      [2, 3, 4, 5, 6].flatMap((d) => [
        { barber_id: b, weekday: d, start_time: "09:00", end_time: "13:00" },
        { barber_id: b, weekday: d, start_time: "14:00", end_time: "18:00" },
      ]),
    ),
    ...[1, 2, 3, 4, 5].map((d) => ({ barber_id: B3, weekday: d, start_time: "10:00", end_time: "18:00" })),
  ] as WorkingBlock[],
  timeOff: [] as { barber_id: string | null; starts_at: string; ends_at: string }[],
  bookings: [] as Booking[],
  version: 0,
};

// ---------------------------------------------------------------------------
// Guardado permanente: almacenamiento de la página privada (capacidad "db").
// Reservas en la colección "bookings"; el horario semanal en "config/horario".
// ---------------------------------------------------------------------------
type DocRef = { set(d: Record<string, unknown>): Promise<void>; update(d: Record<string, unknown>): Promise<void>; onSnapshot(n: (s: { exists: boolean; data(): Record<string, unknown> | undefined }) => void, e?: (err: unknown) => void): () => void };
type Db = {
  doc(path: string): DocRef;
  collection(path: string): { doc(id: string): DocRef; onSnapshot(n: (s: { docs: { data(): Record<string, unknown> | undefined }[] }) => void, e?: (err: unknown) => void): () => void };
};
let db: Db | null = null;
export const sync = { status: "conectando" as "conectando" | "guardado" | "sin-guardar" | "error" };

function save(task: (d: Db) => Promise<void>) {
  if (!db) return;
  task(db).then(
    () => {
      sync.status = "guardado";
      emit();
    },
    () => {
      sync.status = "error";
      emit();
    },
  );
}

export async function connectDb() {
  const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
  db = ((await claude?.use("db").catch(() => null)) as Db | null) ?? null;
  if (!db) {
    sync.status = "sin-guardar";
    emit();
    return;
  }
  db.collection("bookings").onSnapshot(
    (snap) => {
      state.bookings = snap.docs.map((d) => d.data() as unknown as Booking).filter(Boolean).map((b) => ({ ...b }));
      sync.status = "guardado";
      emit();
    },
    () => {
      sync.status = "error";
      emit();
    },
  );
  db.doc("config/horario").onSnapshot((snap) => {
    const blocks = snap.exists ? (snap.data()?.blocks as WorkingBlock[] | undefined) : undefined;
    if (blocks) {
      state.workingHours = blocks.map((b) => ({ ...b }));
      emit();
    }
  });
}

// ---------------------------------------------------------------------------
// Suscripción (useSyncExternalStore)
// ---------------------------------------------------------------------------
const listeners = new Set<() => void>();
function emit() {
  state.version++;
  listeners.forEach((l) => l());
}
export function useStore() {
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state.version,
  );
  return state;
}
export const store = state;

// ---------------------------------------------------------------------------
// Snapshot igual al de get_schedule_snapshot() (sin datos de clientes)
// ---------------------------------------------------------------------------
export function snapshot(): ScheduleSnapshot {
  const barbers = state.barbers.filter((b) => b.active).sort((a, b) => a.sort_order - b.sort_order);
  const services = state.services.filter((s) => s.active).sort((a, b) => a.sort_order - b.sort_order);
  return {
    settings,
    services: services.map(({ id, name, description, duration_min, price_usd }) => ({ id, name, description, duration_min, price_usd })),
    barbers: barbers.map((b) => ({
      id: b.id,
      name: b.name,
      photo_url: b.photo_url,
      bio: b.bio,
      service_ids: state.barberServices.filter(([bid, sid]) => bid === b.id && services.some((s) => s.id === sid)).map(([, sid]) => sid),
    })),
    working_hours: state.workingHours.filter((w) => barbers.some((b) => b.id === w.barber_id)),
    time_off: state.timeOff,
    busy: state.bookings
      .filter((b) => b.status !== "cancelada")
      .map((b) => ({ barber_id: b.barber_id, starts_at: b.starts_at, ends_at: b.blocked_until })),
  };
}

export function weeklyHours() {
  const snap = snapshot();
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
    const blocks = snap.working_hours.filter((w) => w.weekday === weekday);
    if (!blocks.length) return { weekday, open: null, close: null };
    const open = blocks.reduce((m, b) => (b.start_time < m ? b.start_time : m), "23:59");
    const close = blocks.reduce((m, b) => (b.end_time > m ? b.end_time : m), "00:00");
    return { weekday, open, close };
  });
}

// ---------------------------------------------------------------------------
// Crear reserva con las mismas reglas que la función SQL
// ---------------------------------------------------------------------------
type Result = { ok: true; booking: Booking } | { ok: false; error: keyof typeof BOOKING_ERRORS };

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function insertBooking(input: {
  barber_id: string;
  service_id: string;
  starts_at: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  status?: BookingStatus;
  source?: "web" | "admin";
  enforce?: boolean;
  created_at?: string;
}): Result {
  const enforce = input.enforce ?? true;
  const service = state.services.find((s) => s.id === input.service_id);
  const barber = state.barbers.find((b) => b.id === input.barber_id);
  if (!service || (enforce && !service.active)) return { ok: false, error: "INVALID_SERVICE" };
  if (!barber || (enforce && !barber.active)) return { ok: false, error: "INVALID_BARBER" };
  if (input.name.trim().length < 2 || !isValidPhone(input.phone)) return { ok: false, error: "INVALID_INPUT" };
  const start = Date.parse(input.starts_at);
  const end = start + service.duration_min * 60_000;

  if (enforce) {
    if (!state.barberServices.some(([b, s]) => b === barber.id && s === service.id)) return { ok: false, error: "SERVICE_NOT_OFFERED" };
    if (start < Date.now() + settings.min_notice_min * 60_000) return { ok: false, error: "TOO_SOON" };
    const ls = toZonedParts(new Date(start), DEFAULT_TZ);
    const le = toZonedParts(new Date(end), DEFAULT_TZ);
    if (ls.date > addDays(todayIn(DEFAULT_TZ), settings.max_days_ahead)) return { ok: false, error: "TOO_FAR" };
    const inHours =
      ls.date === le.date &&
      state.workingHours.some(
        (w) => w.barber_id === barber.id && w.weekday === ls.weekday && w.start_time <= ls.time && w.end_time >= le.time,
      );
    if (!inHours) return { ok: false, error: "OUTSIDE_HOURS" };
    if (state.timeOff.some((t) => (t.barber_id === null || t.barber_id === barber.id) && overlaps(start, end, Date.parse(t.starts_at), Date.parse(t.ends_at))))
      return { ok: false, error: "TIME_OFF" };
  }

  // Restricción de exclusión: [inicio, fin + margen) no puede cruzarse con otra cita activa
  const blockedUntil = end + settings.buffer_min * 60_000;
  const clash = state.bookings.some(
    (b) => b.barber_id === barber.id && b.status !== "cancelada" && overlaps(start, blockedUntil, Date.parse(b.starts_at), Date.parse(b.blocked_until)),
  );
  if (clash) return { ok: false, error: "SLOT_TAKEN" };

  const booking: Booking = {
    id: crypto.randomUUID(),
    barber_id: barber.id,
    service_id: service.id,
    customer_name: input.name.trim(),
    customer_phone: normalizePhone(input.phone),
    customer_email: input.email?.trim() || null,
    notes: input.notes?.trim() || null,
    starts_at: new Date(start).toISOString(),
    ends_at: new Date(end).toISOString(),
    blocked_until: new Date(blockedUntil).toISOString(),
    status: input.status ?? "pendiente",
    source: input.source ?? "web",
    price_usd: service.price_usd,
    created_at: input.created_at ?? new Date().toISOString(),
  };
  state.bookings.push(booking);
  emit();
  save((d) => d.collection("bookings").doc(booking.id).set({ ...booking }));
  return { ok: true, booking };
}

export function summary(b: Booking) {
  const barber = state.barbers.find((x) => x.id === b.barber_id)!;
  const service = state.services.find((x) => x.id === b.service_id)!;
  return {
    id: b.id,
    starts_at: b.starts_at,
    ends_at: b.ends_at,
    status: b.status,
    customer_name: b.customer_name,
    barber: { id: barber.id, name: barber.name },
    service: { id: service.id, name: service.name, duration_min: service.duration_min, price_usd: service.price_usd },
  };
}

export function setStatus(id: string, status: BookingStatus): string | null {
  const b = state.bookings.find((x) => x.id === id);
  if (!b) return "No se encontró la cita.";
  if (status !== "cancelada" && b.status === "cancelada") {
    const s = Date.parse(b.starts_at);
    const e = Date.parse(b.blocked_until);
    const clash = state.bookings.some(
      (o) => o.id !== b.id && o.barber_id === b.barber_id && o.status !== "cancelada" && overlaps(s, e, Date.parse(o.starts_at), Date.parse(o.blocked_until)),
    );
    if (clash) return "Esa cita se cruza con otra del mismo barbero.";
  }
  // Los documentos que llegan del almacenamiento están congelados: se reemplaza la cita por una copia
  state.bookings = state.bookings.map((x) => (x.id === id ? { ...x, status } : x));
  emit();
  save((d) => d.collection("bookings").doc(id).update({ status }));
  return null;
}

export function setWorkingHours(barberId: string, blocks: { weekday: number; start_time: string; end_time: string }[]): string | null {
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    const day = blocks.filter((b) => b.weekday === d).sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));
    for (let i = 1; i < day.length; i++) if (timeToMinutes(day[i].start_time) < timeToMinutes(day[i - 1].end_time)) return "OVERLAP";
  }
  state.workingHours = [...state.workingHours.filter((w) => w.barber_id !== barberId), ...blocks.map((b) => ({ ...b, barber_id: barberId }))];
  emit();
  const all = state.workingHours;
  save((d) => d.doc("config/horario").set({ blocks: all }));
  return null;
}

// ---------------------------------------------------------------------------
// fetch simulado: /api/disponibilidad y /api/reservas (misma lógica que las rutas)
// ---------------------------------------------------------------------------
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function installFetchMock() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, "http://demo.local");
    if (url.pathname === "/api/disponibilidad") {
      await wait(250);
      const p = url.searchParams;
      const serviceId = p.get("servicio")!;
      const barberId = p.get("barbero")!;
      const snap = snapshot();
      if (p.get("fecha")) {
        const slots = getSlotsForDate({ snapshot: snap, serviceId, barberId, date: p.get("fecha")! });
        return json({ date: p.get("fecha"), slots: slots.map(({ start, time }) => ({ start, time })) });
      }
      const days = getDaysAvailability({ snapshot: snap, serviceId, barberId, from: p.get("desde")!, days: Number(p.get("dias")) });
      return json({ days });
    }
    if (url.pathname === "/api/reservas" && init?.method === "POST") {
      await wait(600);
      const body = JSON.parse(String(init.body));
      if (body.website) return json({ ok: false, error: "INVALID_INPUT", message: BOOKING_ERRORS.INVALID_INPUT }, 400);
      let candidates: string[] = [body.barberId];
      if (body.barberId === ANY_BARBER) {
        const date = toZonedParts(body.start, DEFAULT_TZ).date;
        const snap = snapshot();
        const slot = getSlotsForDate({ snapshot: snap, serviceId: body.serviceId, barberId: ANY_BARBER, date }).find(
          (s) => Date.parse(s.start) === Date.parse(body.start),
        );
        if (!slot) return json({ ok: false, error: "SLOT_TAKEN", message: BOOKING_ERRORS.SLOT_TAKEN }, 409);
        candidates = rankBarbersForSlot(snap, slot.barberIds, date);
      }
      let last: Result | null = null;
      for (const barber_id of candidates) {
        last = insertBooking({ barber_id, service_id: body.serviceId, starts_at: body.start, name: body.name, phone: body.phone, email: body.email, notes: body.notes });
        if (last.ok) return json({ ok: true, booking: summary(last.booking) }, 201);
        if (last.error !== "SLOT_TAKEN") break;
      }
      const code = last && !last.ok ? last.error : "SERVER_ERROR";
      return json({ ok: false, error: code, message: BOOKING_ERRORS[code as keyof typeof BOOKING_ERRORS] }, code === "SLOT_TAKEN" ? 409 : 400);
    }
    return realFetch(input, init);
  };
}

export const DEMO = { B1, B2, B3, whatsapp: BUSINESS.phone };
