import { describe, expect, it } from "vitest";
import { bookingIcs, bookingWhatsappMessage, formatUsd, type BookingSummary } from "../booking-links";
import { formatPhone, isValidPhone, normalizePhone, whatsappUrl } from "../phone";
import { addDays, formatDateLong, formatTime12, todayIn, toZonedParts, weekdayOf, zonedToUtc } from "../tz";

describe("tz", () => {
  it("convierte hora de Caracas a UTC", () => {
    expect(zonedToUtc("2026-11-03", "09:00", "America/Caracas").toISOString()).toBe("2026-11-03T13:00:00.000Z");
    expect(zonedToUtc("2026-12-31", "23:30", "America/Caracas").toISOString()).toBe("2027-01-01T03:30:00.000Z");
  });

  it("funciona en zonas con horario de verano", () => {
    expect(zonedToUtc("2026-03-09", "12:00", "America/New_York").toISOString()).toBe("2026-03-09T16:00:00.000Z");
    expect(zonedToUtc("2026-01-09", "12:00", "America/New_York").toISOString()).toBe("2026-01-09T17:00:00.000Z");
  });

  it("descompone instantes en la zona pedida", () => {
    const p = toZonedParts("2026-11-03T02:30:00Z", "America/Caracas");
    expect(p.date).toBe("2026-11-02");
    expect(p.time).toBe("22:30");
    expect(p.weekday).toBe(1);
    expect(todayIn("America/Caracas", new Date("2026-11-03T02:30:00Z"))).toBe("2026-11-02");
  });

  it("aritmética de fechas", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(weekdayOf("2026-11-03")).toBe(2);
  });

  it("formatos en español", () => {
    expect(formatTime12("09:05")).toBe("9:05 a. m.");
    expect(formatTime12("12:00")).toBe("12:00 p. m.");
    expect(formatTime12("00:30")).toBe("12:30 a. m.");
    expect(formatTime12("18:00")).toBe("6:00 p. m.");
    expect(formatDateLong("2026-11-03")).toBe("martes 3 de noviembre");
  });
});

describe("teléfonos (igual que normalize_phone en SQL)", () => {
  it.each([
    ["0422-2522392", "+584222522392"],
    ["+58 (422) 252-2392", "+584222522392"],
    ["4222522392", "+584222522392"],
    ["584222522392", "+584222522392"],
    ["0058 422 2522392", "+584222522392"],
    ["+1 305 555 1234", "+13055551234"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("valida longitud", () => {
    expect(isValidPhone("0414")).toBe(false);
    expect(isValidPhone("0414-1234567")).toBe(true);
  });

  it("formatea y arma enlaces de WhatsApp", () => {
    expect(formatPhone("04222522392")).toBe("+58 422-2522392");
    expect(whatsappUrl("+58 422-2522392", "Hola")).toBe("https://wa.me/584222522392?text=Hola");
  });
});

describe("confirmación", () => {
  const booking: BookingSummary = {
    id: "3f2a9c1e-0000-4000-8000-000000000000",
    starts_at: "2026-11-03T14:30:00.000Z",
    ends_at: "2026-11-03T15:00:00.000Z",
    customer_name: "Juan Pérez",
    barber: { id: "b", name: "Carlos" },
    service: { id: "s", name: "Corte clásico", duration_min: 30, price_usd: 10 },
  };

  it("precio en USD", () => {
    expect(formatUsd(10)).toBe("$10");
    expect(formatUsd(12.5)).toBe("$12.50");
  });

  it("mensaje de WhatsApp con hora local", () => {
    const msg = bookingWhatsappMessage(booking);
    expect(msg).toContain("martes 3 de noviembre");
    expect(msg).toContain("10:30 a. m.");
    expect(msg).toContain("Carlos");
    expect(msg).toContain("3F2A9C1E");
  });

  it("archivo .ics válido", () => {
    const ics = bookingIcs(booking, new Date("2026-11-01T00:00:00Z"));
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20261103T143000Z");
    expect(ics).toContain("DTEND:20261103T150000Z");
    expect(ics).toContain("LOCATION:Centro Comercial Santa Fe\\, Nivel C3");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("formatos de horario", () => {
  it("horas cortas y duraciones", async () => {
    const { formatTimeShort, formatRangeShort, blocksMinutes, formatDuration } = await import("../tz");
    expect(formatTimeShort("09:00")).toBe("9 a. m.");
    expect(formatTimeShort("13:30")).toBe("1:30 p. m.");
    expect(formatRangeShort("09:00", "13:00")).toBe("9 a. m. a 1 p. m.");
    expect(blocksMinutes([{ start_time: "09:00", end_time: "13:00" }, { start_time: "14:00", end_time: "18:30" }])).toBe(510);
    expect(formatDuration(510)).toBe("8 h 30 min");
    expect(formatDuration(2400)).toBe("40 h");
  });
});
