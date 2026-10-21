import "server-only";
import type { ScheduleSnapshot } from "./availability";
import { createPublicClient } from "./supabase/public";
import { isSupabaseConfigured } from "./supabase/env";

export interface WeeklyHours {
  weekday: number;
  open: string | null;
  close: string | null;
}

export interface BusinessInfo {
  business_name: string;
  whatsapp: string;
  address: string;
  instagram: string | null;
  timezone: string;
  max_days_ahead: number;
  weekly_hours: WeeklyHours[];
}

export interface Catalog {
  snapshot: ScheduleSnapshot;
  info: BusinessInfo;
}

/** Snapshot de agenda (sin datos de clientes) entre dos instantes. */
export async function getSnapshot(from: Date, to: Date): Promise<ScheduleSnapshot> {
  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_schedule_snapshot", {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) throw new Error(error.message);
  return data as ScheduleSnapshot;
}

/** Barberos, servicios, ajustes y horario semanal para las páginas públicas. */
export async function getCatalog(): Promise<Catalog | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = createPublicClient();
    const now = new Date();
    const [snap, info] = await Promise.all([
      getSnapshot(now, new Date(now.getTime() + 60_000)),
      supabase.rpc("public_business_info"),
    ]);
    if (info.error) throw new Error(info.error.message);
    return { snapshot: snap, info: info.data as BusinessInfo };
  } catch (e) {
    console.error("[catalog]", e);
    return null;
  }
}
