import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDaysAvailability, getSlotsForDate } from "@/lib/availability";
import { getSnapshot } from "@/lib/public-data";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { addDays, DEFAULT_TZ, zonedToUtc } from "@/lib/tz";

export const dynamic = "force-dynamic";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const query = z.object({
  servicio: z.string().uuid(),
  barbero: z.union([z.literal("any"), z.string().uuid()]),
  fecha: z.string().regex(dateRe).optional(),
  desde: z.string().regex(dateRe).optional(),
  dias: z.coerce.number().int().min(1).max(62).optional(),
});

/**
 * GET /api/disponibilidad?servicio=…&barbero=…|any&fecha=YYYY-MM-DD → turnos de un día
 * GET /api/disponibilidad?servicio=…&barbero=…|any&desde=YYYY-MM-DD&dias=N → turnos por día
 * Solo devuelve horas libres: nunca datos de otras citas.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const { servicio, barbero, fecha, desde, dias } = parsed.data;
  const headers = { "Cache-Control": "no-store" };

  try {
    if (fecha) {
      const snapshot = await getSnapshot(zonedToUtc(fecha, "00:00", DEFAULT_TZ), zonedToUtc(addDays(fecha, 1), "00:00", DEFAULT_TZ));
      const slots = getSlotsForDate({ snapshot, serviceId: servicio, barberId: barbero, date: fecha });
      return NextResponse.json({ date: fecha, slots: slots.map(({ start, time }) => ({ start, time })) }, { headers });
    }
    if (desde && dias) {
      const snapshot = await getSnapshot(zonedToUtc(desde, "00:00", DEFAULT_TZ), zonedToUtc(addDays(desde, dias), "00:00", DEFAULT_TZ));
      const days = getDaysAvailability({ snapshot, serviceId: servicio, barberId: barbero, from: desde, days: dias });
      return NextResponse.json({ days }, { headers });
    }
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  } catch (e) {
    console.error("[disponibilidad]", e);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
