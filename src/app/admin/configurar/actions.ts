"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/admin/types";
import { installDatabase } from "@/lib/setup/install";
import { getSetupStatus, needsSetup } from "@/lib/setup/status";
import { createSessionClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const schema = z
  .object({
    email: z.string().trim().toLowerCase().email("Escribe un correo válido."),
    password: z.string().min(6, "La clave debe tener al menos 6 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Las dos claves no coinciden.", path: ["confirm"] });

/**
 * Configuración inicial: SOLO funciona mientras no exista ningún administrador.
 * 1) crea la base de datos si está vacía, 2) crea el usuario, 3) lo marca como
 * administrador y 4) inicia su sesión.
 */
export async function setupFirstAdmin(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = schema.safeParse({ email: fd.get("email"), password: fd.get("password"), confirm: fd.get("confirm") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const { email, password } = parsed.data;

  const status = await getSetupStatus();
  if (!status.connected) return { ok: false, message: "La base de datos todavía no está conectada en Vercel." };
  if (!needsSetup(status)) return { ok: false, message: "El panel ya está configurado. Entra con tu correo y tu clave." };

  if (!status.dbReady) {
    if (!status.canInstall) {
      return { ok: false, message: "No se pudo crear la base de datos automáticamente: falta la variable POSTGRES_URL en Vercel." };
    }
    try {
      await installDatabase();
    } catch (e) {
      console.error("[configurar] instalación", e);
      return { ok: false, message: "No se pudo crear la base de datos. Inténtalo de nuevo en un minuto." };
    }
  }

  const service = createServiceClient()!;
  // Esperar a que la API vea las tablas recién creadas (hasta ~15 s)
  for (let i = 0; i < 30; i++) {
    const probe = await service.from("admins").select("user_id", { count: "exact", head: true });
    if (!probe.error) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  // Crear el usuario (o reutilizarlo si ya existía con ese correo, poniéndole esta clave)
  let userId: string | undefined;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    const list = await service.auth.admin.listUsers({ perPage: 1000 });
    const existing = list.data?.users.find((u) => u.email?.toLowerCase() === email);
    if (!existing) {
      console.error("[configurar] usuario", created.error);
      return { ok: false, message: "No se pudo crear el usuario. Revisa el correo e inténtalo de nuevo." };
    }
    userId = existing.id;
    const upd = await service.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (upd.error) return { ok: false, message: "No se pudo guardar la clave. Usa una más larga e inténtalo otra vez." };
  }

  // Volver a comprobar justo antes de dar permisos: solo el primer administrador se crea aquí
  const again = await service.from("admins").select("user_id", { count: "exact", head: true });
  if ((again.count ?? 0) > 0) return { ok: false, message: "El panel ya está configurado. Entra con tu correo y tu clave." };
  const ins = await service.from("admins").insert({ user_id: userId });
  if (ins.error) {
    console.error("[configurar] admin", ins.error);
    return { ok: false, message: "No se pudo dar acceso de administrador. Inténtalo de nuevo." };
  }

  // La portada y la reserva muestran ya los datos de la base
  revalidatePath("/");
  revalidatePath("/reservar");

  const supabase = await createSessionClient();
  const login = await supabase.auth.signInWithPassword({ email, password });
  if (login.error) redirect("/admin/login");
  redirect("/admin");
}
