// Sustituye a src/app/admin/actions.ts (acciones del servidor) en la vista previa.
import type { ActionResult, BookingStatus } from "@/lib/admin/types";
import { setStatus, setWorkingHours } from "./store";

export interface HourBlock {
  weekday: number;
  start_time: string;
  end_time: string;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function setBookingStatus(id: string, status: BookingStatus): Promise<ActionResult> {
  await wait(300);
  const err = setStatus(id, status);
  return err ? { ok: false, message: err } : { ok: true, message: "Cita actualizada." };
}

export async function saveWorkingHours(barberId: string, blocks: HourBlock[]): Promise<ActionResult> {
  await wait(400);
  const err = setWorkingHours(barberId, blocks);
  return err ? { ok: false, message: "Hay bloques de horario que se cruzan el mismo día. Revísalos." } : { ok: true, message: "Horario guardado." };
}

export async function signOut() {
  window.dispatchEvent(new CustomEvent("demo:lock"));
}
