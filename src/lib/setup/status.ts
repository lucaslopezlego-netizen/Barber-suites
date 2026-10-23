import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";
import { applyAccessReset } from "./reset";

export interface SetupStatus {
  /** Hay URL, clave pública y clave secreta de Supabase. */
  connected: boolean;
  /** Las tablas de Barber Suites existen. */
  dbReady: boolean;
  /** Ya hay al menos un administrador. */
  hasAdmin: boolean;
  /** Se puede crear la base de datos automáticamente (hay conexión directa a Postgres). */
  canInstall: boolean;
}

/** Cadena de conexión directa a Postgres (la integración de Vercel la crea). */
export function postgresUrl() {
  return process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL || "";
}

export async function getSetupStatus(): Promise<SetupStatus> {
  await applyAccessReset();
  const service = createServiceClient();
  const connected = isSupabaseConfigured() && service !== null;
  const canInstall = Boolean(postgresUrl());
  if (!service) return { connected, dbReady: false, hasAdmin: false, canInstall };

  const settings = await service.from("settings").select("id").limit(1);
  if (settings.error) return { connected, dbReady: false, hasAdmin: false, canInstall };

  const admins = await service.from("admins").select("user_id", { count: "exact", head: true });
  return { connected, dbReady: true, hasAdmin: (admins.count ?? 0) > 0, canInstall };
}

/** Falta la configuración inicial: base de datos vacía o sin ningún administrador. */
export function needsSetup(s: SetupStatus) {
  return s.connected && (!s.dbReady || !s.hasAdmin);
}
