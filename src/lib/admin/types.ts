export type BookingStatus = "pendiente" | "confirmada" | "completada" | "cancelada" | "no_asistio";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asistió",
};

export interface AdminBooking {
  id: string;
  starts_at: string;
  ends_at: string;
  status: BookingStatus;
  source: "web" | "admin";
  price_usd: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  created_at: string;
  barber: { id: string; name: string } | null;
  service: { id: string; name: string; duration_min: number } | null;
}

export const BOOKING_SELECT =
  "id, starts_at, ends_at, status, source, price_usd, customer_name, customer_phone, customer_email, notes, created_at, barber:barbers(id, name), service:services(id, name, duration_min)";

export interface ActionResult {
  ok: boolean;
  message: string;
}

/** Ingreso que cuenta: todo menos canceladas y no asistió. */
export function countsAsRevenue(status: BookingStatus) {
  return status !== "cancelada" && status !== "no_asistio";
}
