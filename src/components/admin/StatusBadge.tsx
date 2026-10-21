import { STATUS_LABEL, type BookingStatus } from "@/lib/admin/types";

const STYLE: Record<BookingStatus, string> = {
  pendiente: "border-warn/40 bg-warn/10 text-warn",
  confirmada: "border-info/40 bg-info/10 text-info",
  completada: "border-ok/40 bg-ok/10 text-ok",
  cancelada: "border-line-strong bg-panel-2 text-subtle line-through",
  no_asistio: "border-danger/40 bg-danger/10 text-danger",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLE[status]}`}>{STATUS_LABEL[status]}</span>;
}
