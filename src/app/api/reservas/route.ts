import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ANY_BARBER, getSlotsForDate, rankBarbersForSlot } from "@/lib/availability";
import { BOOKING_ERRORS } from "@/lib/booking-errors";
import { isValidPhone } from "@/lib/phone";
import { getSnapshot } from "@/lib/public-data";
import { createServiceClient } from "@/lib/supabase/service";
import { addDays, DEFAULT_TZ, toZonedParts, zonedToUtc } from "@/lib/tz";

export const dynamic = "force-dynamic";

const body = z.object({
  barberId: z.union([z.literal(ANY_BARBER), z.string().uuid()]),
  serviceId: z.string().uuid(),
  start: z.string().datetime(),
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().refine(isValidPhone),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]).optional(),
  notes: z.string().trim().max(500).optional(),
  // Anti-spam
  website: z.string().optional(), // honeypot: debe venir vacío
  startedAt: z.number().optional(), // ms en que se mostró el formulario
});

type RpcResult =
  | { ok: true; booking: Record<string, unknown> }
  | { ok: false; error: keyof typeof BOOKING_ERRORS | string; detail?: string };

function fail(error: string, status = 400) {
  const message = BOOKING_ERRORS[error as keyof typeof BOOKING_ERRORS] ?? BOOKING_ERRORS.SERVER_ERROR;
  return NextResponse.json({ ok: false, error, message }, { status });
}

function clientIpHash(req: NextRequest): string | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
  if (!ip) return null;
  const salt = process.env.RATE_LIMIT_SALT ?? "barber-suites";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  if (!supabase) return fail("NOT_CONFIGURED", 503);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("INVALID_INPUT");
  }
  const parsed = body.safeParse(json);
  if (!parsed.success) return fail("INVALID_INPUT");
  const input = parsed.data;

  // Honeypot o formulario enviado en menos de 2 s ⇒ bot. Respuesta genérica.
  if (input.website || (input.startedAt && Date.now() - input.startedAt < 2000)) {
    return fail("INVALID_INPUT");
  }

  // Barberos a intentar, en orden
  let candidates: string[] = [input.barberId];
  if (input.barberId === ANY_BARBER) {
    const date = toZonedParts(input.start, DEFAULT_TZ).date;
    const snapshot = await getSnapshot(zonedToUtc(date, "00:00", DEFAULT_TZ), zonedToUtc(addDays(date, 1), "00:00", DEFAULT_TZ));
    const slot = getSlotsForDate({ snapshot, serviceId: input.serviceId, barberId: ANY_BARBER, date }).find(
      (s) => Date.parse(s.start) === Date.parse(input.start),
    );
    if (!slot) return fail("SLOT_TAKEN", 409);
    candidates = rankBarbersForSlot(snapshot, slot.barberIds, date).slice(0, 3);
  }

  const ipHash = clientIpHash(req);
  let last: RpcResult | null = null;
  for (const barberId of candidates) {
    const { data, error } = await supabase.rpc("create_booking_public", {
      p_barber_id: barberId,
      p_service_id: input.serviceId,
      p_starts_at: input.start,
      p_name: input.name,
      p_phone: input.phone,
      p_email: input.email || null,
      p_notes: input.notes || null,
      p_ip_hash: ipHash,
    });
    if (error) {
      console.error("[reservas]", error);
      return fail("SERVER_ERROR", 500);
    }
    last = data as RpcResult;
    if (last.ok) return NextResponse.json({ ok: true, booking: last.booking }, { status: 201 });
    // Con "cualquier barbero", si otro cliente tomó a uno, probamos el siguiente
    if (last.error !== "SLOT_TAKEN") break;
  }

  const code = last && !last.ok ? last.error : "SERVER_ERROR";
  const status = code === "SLOT_TAKEN" ? 409 : code === "RATE_LIMIT" || code === "TOO_MANY_BOOKINGS" ? 429 : 400;
  return fail(code, status);
}
