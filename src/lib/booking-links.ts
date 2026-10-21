// Mensaje de WhatsApp prellenado y archivo .ics para "Agregar a mi calendario".
import { BUSINESS } from "./business";
import { DEFAULT_TZ, formatDateLong, formatInstantTime, toZonedParts } from "./tz";

export interface BookingSummary {
  id: string;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  barber: { id: string; name: string };
  service: { id: string; name: string; duration_min: number; price_usd: number };
}

export function formatUsd(value: number): string {
  return `$${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 2)}`;
}

export function bookingWhatsappMessage(b: BookingSummary, tz: string = DEFAULT_TZ): string {
  const date = formatDateLong(toZonedParts(b.starts_at, tz).date);
  return [
    `¡Hola, ${BUSINESS.name}! Acabo de reservar desde la web:`,
    ``,
    `• Servicio: ${b.service.name} (${formatUsd(b.service.price_usd)})`,
    `• Barbero: ${b.barber.name}`,
    `• Fecha: ${date}`,
    `• Hora: ${formatInstantTime(b.starts_at, tz)}`,
    `• A nombre de: ${b.customer_name}`,
    ``,
    `Código de reserva: ${b.id.slice(0, 8).toUpperCase()}`,
  ].join("\n");
}

function icsDate(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function bookingIcs(b: BookingSummary, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Barber Suites//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@barbersuites`,
    `DTSTAMP:${icsDate(now.toISOString())}`,
    `DTSTART:${icsDate(b.starts_at)}`,
    `DTEND:${icsDate(b.ends_at)}`,
    `SUMMARY:${icsEscape(`${b.service.name} · ${BUSINESS.name}`)}`,
    `DESCRIPTION:${icsEscape(
      `Barbero: ${b.barber.name}\nServicio: ${b.service.name} (${formatUsd(b.service.price_usd)})\nWhatsApp: ${BUSINESS.phoneDisplay}`,
    )}`,
    `LOCATION:${icsEscape(BUSINESS.address)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsEscape(`Tu cita en ${BUSINESS.name} es en 1 hora`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
