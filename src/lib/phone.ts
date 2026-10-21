// Igual que public.normalize_phone() en SQL: formato +<país><número>.
export function normalizePhone(input: string): string {
  const raw = (input ?? "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("58") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+58${digits.slice(1)}`;
  if (digits.length === 10) return `+58${digits}`;
  return `+${digits}`;
}

export function isValidPhone(input: string): boolean {
  return /^\+[0-9]{7,15}$/.test(normalizePhone(input));
}

/** "+58 422-252-2392" para mostrar. */
export function formatPhone(phone: string): string {
  const n = normalizePhone(phone);
  const m = n.match(/^\+58(\d{3})(\d{3})(\d{4})$/);
  if (m) return `+58 ${m[1]}-${m[2]}${m[3]}`;
  return n;
}

/** Enlace wa.me (solo dígitos). */
export function whatsappUrl(phone: string, message?: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, "");
  return message ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : `https://wa.me/${digits}`;
}
