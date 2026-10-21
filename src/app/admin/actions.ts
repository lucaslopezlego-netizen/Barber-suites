"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { friendlyError } from "@/lib/admin/errors";
import type { ActionResult, BookingStatus } from "@/lib/admin/types";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { createSessionClient } from "@/lib/supabase/server";
import { addDays, DEFAULT_TZ, timeToMinutes, zonedToUtc } from "@/lib/tz";

const uuid = z.string().uuid();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida");

function ok(message: string): ActionResult {
  return { ok: true, message };
}
function fail(message: string): ActionResult {
  return { ok: false, message };
}
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function revalidatePublic() {
  revalidatePath("/");
  revalidatePath("/reservar");
}

// ---------------------------------------------------------------------------
// Sesión
// ---------------------------------------------------------------------------
export async function signOut() {
  const supabase = await createSessionClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// Citas
// ---------------------------------------------------------------------------
const STATUSES: BookingStatus[] = ["pendiente", "confirmada", "completada", "cancelada", "no_asistio"];

export async function setBookingStatus(id: string, status: BookingStatus): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(id).success || !STATUSES.includes(status)) return fail("Datos inválidos.");
  const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
  if (error) return fail(friendlyError(error));
  revalidatePath("/admin", "layout");
  return ok("Cita actualizada.");
}

const newBookingSchema = z.object({
  barber_id: uuid,
  service_id: uuid,
  date: dateStr,
  time: timeStr,
  name: z.string().min(2, "Escribe el nombre del cliente.").max(80),
  phone: z.string().refine(isValidPhone, "Teléfono inválido."),
  email: z.union([z.literal(""), z.string().email("Email inválido.")]),
  notes: z.string().max(500),
  status: z.enum(["pendiente", "confirmada", "completada"]),
});

export async function createAdminBooking(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = newBookingSchema.safeParse({
    barber_id: str(fd, "barber_id"),
    service_id: str(fd, "service_id"),
    date: str(fd, "date"),
    time: str(fd, "time"),
    name: str(fd, "name"),
    phone: str(fd, "phone"),
    email: str(fd, "email"),
    notes: str(fd, "notes"),
    status: str(fd, "status") || "confirmada",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa el formulario.");
  const d = parsed.data;
  const { error } = await supabase.rpc("admin_create_booking", {
    p_barber_id: d.barber_id,
    p_service_id: d.service_id,
    p_starts_at: zonedToUtc(d.date, d.time, DEFAULT_TZ).toISOString(),
    p_name: d.name,
    p_phone: d.phone,
    p_email: d.email || null,
    p_notes: d.notes || null,
    p_status: d.status,
    p_enforce_rules: fd.get("enforce") === "on",
  });
  if (error) return fail(friendlyError(error));
  revalidatePath("/admin", "layout");
  redirect(`/admin/agenda?fecha=${d.date}`);
}

// ---------------------------------------------------------------------------
// Barberos
// ---------------------------------------------------------------------------
const MAX_PHOTO = 5 * 1024 * 1024;

export async function saveBarber(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const bio = str(fd, "bio");
  if (name.length < 2) return fail("Escribe el nombre del barbero.");
  if (bio.length > 280) return fail("La descripción es muy larga (máximo 280 caracteres).");
  const serviceIds = fd.getAll("service_ids").map(String).filter((s) => uuid.safeParse(s).success);

  const row: Record<string, unknown> = { name, bio: bio || null, active: fd.get("active") === "on" };
  let barberId = id;
  if (id) {
    const { error } = await supabase.from("barbers").update(row).eq("id", id);
    if (error) return fail(friendlyError(error));
  } else {
    const { data: last } = await supabase.from("barbers").select("sort_order").order("sort_order", { ascending: false }).limit(1);
    row.sort_order = (last?.[0]?.sort_order ?? 0) + 1;
    const { data, error } = await supabase.from("barbers").insert(row).select("id").single();
    if (error || !data) return fail(friendlyError(error));
    barberId = data.id;
  }

  const photo = fd.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (!photo.type.startsWith("image/")) return fail("La foto debe ser una imagen (JPG, PNG o WebP).");
    if (photo.size > MAX_PHOTO) return fail("La foto pesa demasiado (máximo 5 MB).");
    const ext = (photo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${barberId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("barber-photos").upload(path, photo, { contentType: photo.type, upsert: false });
    if (upErr) return fail("No se pudo subir la foto. Inténtalo de nuevo.");
    const { data: pub } = supabase.storage.from("barber-photos").getPublicUrl(path);
    await supabase.from("barbers").update({ photo_url: pub.publicUrl }).eq("id", barberId);
  } else if (fd.get("remove_photo") === "on") {
    await supabase.from("barbers").update({ photo_url: null }).eq("id", barberId);
  }

  const { error: svcErr } = await supabase.rpc("admin_set_barber_services", { p_barber_id: barberId, p_service_ids: serviceIds });
  if (svcErr) return fail(friendlyError(svcErr));

  revalidatePath("/admin", "layout");
  revalidatePublic();
  redirect("/admin/barberos");
}

export async function toggleBarberActive(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("barbers").update({ active }).eq("id", id);
  if (error) return fail(friendlyError(error));
  revalidatePath("/admin/barberos");
  revalidatePublic();
  return ok(active ? "Barbero activado." : "Barbero desactivado: ya no aparece en la web.");
}

export async function moveBarber(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("barbers").select("id, sort_order").order("sort_order").order("name");
  if (!data) return fail("No se pudo reordenar.");
  const i = data.findIndex((b) => b.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= data.length) return ok("");
  const ordered = [...data];
  [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  for (let k = 0; k < ordered.length; k++) {
    if (ordered[k].sort_order !== k + 1) await supabase.from("barbers").update({ sort_order: k + 1 }).eq("id", ordered[k].id);
  }
  revalidatePath("/admin/barberos");
  revalidatePublic();
  return ok("Orden actualizado.");
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------
const serviceSchema = z.object({
  name: z.string().min(2, "Escribe el nombre del servicio.").max(80),
  description: z.string().max(280, "Descripción muy larga (máximo 280)."),
  duration_min: z.coerce.number().int().min(5, "Duración mínima: 5 min.").max(480, "Duración máxima: 8 horas."),
  price_usd: z.coerce.number().min(0, "El precio no puede ser negativo.").max(10000),
  sort_order: z.coerce.number().int().min(0).max(999),
});

export async function saveService(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const id = str(fd, "id");
  const parsed = serviceSchema.safeParse({
    name: str(fd, "name"),
    description: str(fd, "description"),
    duration_min: str(fd, "duration_min"),
    price_usd: str(fd, "price_usd").replace(",", "."),
    sort_order: str(fd, "sort_order") || "0",
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa el formulario.");
  const row = { ...parsed.data, description: parsed.data.description || null, active: fd.get("active") === "on" };
  const barberIds = fd.getAll("barber_ids").map(String).filter((s) => uuid.safeParse(s).success);

  let serviceId = id;
  if (id) {
    const { error } = await supabase.from("services").update(row).eq("id", id);
    if (error) return fail(friendlyError(error));
  } else {
    const { data, error } = await supabase.from("services").insert(row).select("id").single();
    if (error || !data) return fail(friendlyError(error));
    serviceId = data.id;
  }
  const { error: relErr } = await supabase.rpc("admin_set_service_barbers", { p_service_id: serviceId, p_barber_ids: barberIds });
  if (relErr) return fail(friendlyError(relErr));

  revalidatePath("/admin", "layout");
  revalidatePublic();
  redirect("/admin/servicios");
}

export async function toggleServiceActive(id: string, active: boolean): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("services").update({ active }).eq("id", id);
  if (error) return fail(friendlyError(error));
  revalidatePath("/admin/servicios");
  revalidatePublic();
  return ok(active ? "Servicio activado." : "Servicio desactivado.");
}

// ---------------------------------------------------------------------------
// Horarios
// ---------------------------------------------------------------------------
export interface HourBlock {
  weekday: number;
  start_time: string;
  end_time: string;
}

export async function saveWorkingHours(barberId: string, blocks: HourBlock[]): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(barberId).success) return fail("Barbero inválido.");
  for (const b of blocks) {
    if (!(b.weekday >= 0 && b.weekday <= 6) || !timeStr.safeParse(b.start_time).success || !timeStr.safeParse(b.end_time).success) {
      return fail("Hay una hora mal escrita.");
    }
    if (timeToMinutes(b.start_time) >= timeToMinutes(b.end_time)) {
      return fail("En cada bloque, la hora de inicio debe ser anterior a la de fin.");
    }
  }
  const { error } = await supabase.rpc("admin_set_working_hours", { p_barber_id: barberId, p_blocks: blocks });
  if (error) return fail(friendlyError(error));
  revalidatePath("/admin/horarios");
  revalidatePublic();
  return ok("Horario guardado.");
}

// ---------------------------------------------------------------------------
// Bloqueos
// ---------------------------------------------------------------------------
export async function createTimeOff(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const barber = str(fd, "barber_id");
  const barberId = barber === "all" ? null : barber;
  if (barberId && !uuid.safeParse(barberId).success) return fail("Elige un barbero.");
  const kind = str(fd, "kind");
  const reason = str(fd, "reason").slice(0, 140) || null;

  let startsAt: Date;
  let endsAt: Date;
  if (kind === "hours") {
    const date = dateStr.safeParse(str(fd, "date"));
    const from = timeStr.safeParse(str(fd, "from_time"));
    const to = timeStr.safeParse(str(fd, "to_time"));
    if (!date.success || !from.success || !to.success) return fail("Completa la fecha y las horas.");
    if (timeToMinutes(from.data) >= timeToMinutes(to.data)) return fail("La hora de inicio debe ser anterior a la de fin.");
    startsAt = zonedToUtc(date.data, from.data, DEFAULT_TZ);
    endsAt = zonedToUtc(date.data, to.data, DEFAULT_TZ);
  } else {
    const from = dateStr.safeParse(str(fd, "from_date"));
    const toRaw = str(fd, "to_date") || str(fd, "from_date");
    const to = dateStr.safeParse(toRaw);
    if (!from.success || !to.success) return fail("Elige la fecha.");
    if (to.data < from.data) return fail("La fecha final no puede ser anterior a la inicial.");
    startsAt = zonedToUtc(from.data, "00:00", DEFAULT_TZ);
    endsAt = zonedToUtc(addDays(to.data, 1), "00:00", DEFAULT_TZ);
  }

  const { error } = await supabase
    .from("time_off")
    .insert({ barber_id: barberId, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), reason });
  if (error) return fail(friendlyError(error));

  // Avisar si ya había citas en ese horario
  let q = supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .in("status", ["pendiente", "confirmada"])
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString());
  if (barberId) q = q.eq("barber_id", barberId);
  const { count } = await q;

  revalidatePath("/admin/bloqueos");
  revalidatePath("/admin/agenda");
  return ok(
    count
      ? `Bloqueo creado. Ojo: ya hay ${count} ${count === 1 ? "cita" : "citas"} en ese horario. Revísalas en la agenda.`
      : "Bloqueo creado.",
  );
}

export async function deleteTimeOff(id: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("time_off").delete().eq("id", id);
  if (error) return fail(friendlyError(error));
  revalidatePath("/admin/bloqueos");
  return ok("Bloqueo eliminado.");
}

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------
const settingsSchema = z.object({
  slot_interval_min: z.coerce.number().int().min(5).max(120),
  min_notice_min: z.coerce.number().int().min(0).max(10080),
  max_days_ahead: z.coerce.number().int().min(1, "Mínimo 1 día.").max(60, "Máximo 60 días."),
  buffer_min: z.coerce.number().int().min(0).max(120),
  whatsapp: z.string().refine(isValidPhone, "WhatsApp inválido."),
  address: z.string().min(5, "Escribe la dirección.").max(200),
  instagram: z.string().max(60),
});

export async function saveSettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const parsed = settingsSchema.safeParse({
    slot_interval_min: str(fd, "slot_interval_min"),
    min_notice_min: str(fd, "min_notice_min"),
    max_days_ahead: str(fd, "max_days_ahead"),
    buffer_min: str(fd, "buffer_min"),
    whatsapp: str(fd, "whatsapp"),
    address: str(fd, "address"),
    instagram: str(fd, "instagram").replace(/^@/, ""),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa el formulario.");
  const { error } = await supabase
    .from("settings")
    .update({ ...parsed.data, whatsapp: normalizePhone(parsed.data.whatsapp), instagram: parsed.data.instagram || null })
    .eq("id", 1);
  if (error) return fail(friendlyError(error));
  revalidatePath("/admin/ajustes");
  revalidatePublic();
  return ok("Ajustes guardados.");
}
