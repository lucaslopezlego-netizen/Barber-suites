import { describe, expect, it } from "vitest";
import {
  ANY_BARBER,
  getDaysAvailability,
  getSlotsForDate,
  rankBarbersForSlot,
  type ScheduleSnapshot,
} from "../availability";

// Fechas de referencia (Caracas = UTC-4):
//   lunes 2 nov 2026, martes 3 nov 2026, miércoles 4 nov 2026
const MON = "2026-11-02";
const TUE = "2026-11-03";
const WED = "2026-11-04";
// "Ahora": lunes 2 nov, 8:00 a. m. en Caracas
const NOW = new Date("2026-11-02T12:00:00Z");

const A = "barber-a";
const B = "barber-b";
const CORTE = "corte"; // 30 min
const FADE = "fade"; // 45 min
const COLOR = "color"; // 120 min, solo B

/** Hora local de Caracas → ISO UTC */
const at = (date: string, time: string) => {
  const [h, m] = time.split(":").map(Number);
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h + 4, m)).toISOString();
};

function snapshot(overrides: Partial<ScheduleSnapshot> = {}, settings: Partial<ScheduleSnapshot["settings"]> = {}): ScheduleSnapshot {
  const week = (barber: string, days: number[], blocks: [string, string][]) =>
    days.flatMap((weekday) => blocks.map(([start_time, end_time]) => ({ barber_id: barber, weekday, start_time, end_time })));
  return {
    settings: {
      slot_interval_min: 15,
      min_notice_min: 60,
      max_days_ahead: 30,
      buffer_min: 0,
      timezone: "America/Caracas",
      ...settings,
    },
    services: [
      { id: CORTE, name: "Corte", duration_min: 30, price_usd: 10 },
      { id: FADE, name: "Fade", duration_min: 45, price_usd: 12 },
      { id: COLOR, name: "Color", duration_min: 120, price_usd: 35 },
    ],
    barbers: [
      { id: A, name: "A", service_ids: [CORTE, FADE] },
      { id: B, name: "B", service_ids: [CORTE, FADE, COLOR] },
    ],
    working_hours: [
      // A: martes a sábado 9–13 y 14–18 (pausa de almuerzo)
      ...week(A, [2, 3, 4, 5, 6], [["09:00", "13:00"], ["14:00", "18:00"]]),
      // B: lunes a viernes 10–18 corrido
      ...week(B, [1, 2, 3, 4, 5], [["10:00", "18:00"]]),
    ],
    time_off: [],
    busy: [],
    ...overrides,
  };
}

const times = (slots: { time: string }[]) => slots.map((s) => s.time);

describe("horario laboral y bordes", () => {
  it("parte el horario en turnos según el intervalo y la duración", () => {
    const slots = getSlotsForDate({ snapshot: snapshot(), serviceId: CORTE, barberId: A, date: TUE, now: NOW });
    const t = times(slots);
    expect(t[0]).toBe("09:00");
    expect(t).toContain("12:30"); // termina justo a las 13:00
    expect(t).not.toContain("12:45"); // terminaría 13:15, en la pausa
    expect(t).not.toContain("13:00");
    expect(t).not.toContain("13:45");
    expect(t).toContain("14:00");
    expect(t[t.length - 1]).toBe("17:30"); // termina justo a las 18:00
    expect(slots).toHaveLength(30);
  });

  it("un servicio largo no cabe al final del bloque", () => {
    const t = times(getSlotsForDate({ snapshot: snapshot(), serviceId: FADE, barberId: A, date: TUE, now: NOW }));
    expect(t).toContain("12:15");
    expect(t).not.toContain("12:30");
    expect(t[t.length - 1]).toBe("17:15");
  });

  it("día sin horario ⇒ sin turnos", () => {
    expect(getSlotsForDate({ snapshot: snapshot(), serviceId: CORTE, barberId: A, date: MON, now: NOW })).toEqual([]);
  });

  it("respeta el intervalo configurado", () => {
    const t = times(
      getSlotsForDate({ snapshot: snapshot({}, { slot_interval_min: 30 }), serviceId: CORTE, barberId: A, date: TUE, now: NOW }),
    );
    expect(t.slice(0, 3)).toEqual(["09:00", "09:30", "10:00"]);
  });

  it("barbero que no hace el servicio ⇒ sin turnos", () => {
    expect(getSlotsForDate({ snapshot: snapshot(), serviceId: COLOR, barberId: A, date: TUE, now: NOW })).toEqual([]);
  });

  it("servicio inexistente ⇒ sin turnos", () => {
    expect(getSlotsForDate({ snapshot: snapshot(), serviceId: "nope", barberId: A, date: TUE, now: NOW })).toEqual([]);
  });
});

describe("solapamientos con citas existentes", () => {
  const busy = [{ barber_id: A, starts_at: at(TUE, "10:00"), ends_at: at(TUE, "10:30") }];

  it("quita los turnos que pisan una cita y deja los contiguos", () => {
    const t = times(getSlotsForDate({ snapshot: snapshot({ busy }), serviceId: CORTE, barberId: A, date: TUE, now: NOW }));
    expect(t).toContain("09:30"); // termina 10:00 justo
    expect(t).not.toContain("09:45");
    expect(t).not.toContain("10:00");
    expect(t).not.toContain("10:15");
    expect(t).toContain("10:30"); // empieza justo al terminar
  });

  it("la duración del servicio cuenta para el solape", () => {
    const t = times(getSlotsForDate({ snapshot: snapshot({ busy }), serviceId: FADE, barberId: A, date: TUE, now: NOW }));
    expect(t).toContain("09:15"); // 9:15–10:00
    expect(t).not.toContain("09:30"); // 9:30–10:15
  });

  it("las citas de otro barbero no afectan", () => {
    const t = times(getSlotsForDate({ snapshot: snapshot({ busy }), serviceId: CORTE, barberId: B, date: TUE, now: NOW }));
    expect(t).toContain("10:00");
  });

  it("aplica el margen entre citas en ambos sentidos", () => {
    // Con margen de 10 min la cita existente bloquea hasta las 10:40 (blocked_until)
    const busyWithBuffer = [{ barber_id: A, starts_at: at(TUE, "10:00"), ends_at: at(TUE, "10:40") }];
    const t = times(
      getSlotsForDate({
        snapshot: snapshot({ busy: busyWithBuffer }, { buffer_min: 10 }),
        serviceId: CORTE,
        barberId: A,
        date: TUE,
        now: NOW,
      }),
    );
    expect(t).toContain("09:15"); // 9:15–9:45 + 10 = 9:55 < 10:00
    expect(t).not.toContain("09:30"); // 9:30–10:00 + 10 = 10:10 > 10:00
    expect(t).not.toContain("10:30");
    expect(t).toContain("10:45");
  });
});

describe("bloqueos", () => {
  it("bloqueo del barbero quita los turnos que lo tocan", () => {
    const time_off = [{ barber_id: A, starts_at: at(TUE, "10:00"), ends_at: at(TUE, "12:00") }];
    const t = times(getSlotsForDate({ snapshot: snapshot({ time_off }), serviceId: CORTE, barberId: A, date: TUE, now: NOW }));
    expect(t).toContain("09:30");
    expect(t).not.toContain("09:45");
    expect(t).not.toContain("11:45");
    expect(t).toContain("12:00");
  });

  it("bloqueo general (barber_id null) afecta a todos", () => {
    const time_off = [{ barber_id: null, starts_at: at(TUE, "00:00"), ends_at: at(WED, "00:00") }];
    const s = snapshot({ time_off });
    expect(getSlotsForDate({ snapshot: s, serviceId: CORTE, barberId: A, date: TUE, now: NOW })).toEqual([]);
    expect(getSlotsForDate({ snapshot: s, serviceId: CORTE, barberId: B, date: TUE, now: NOW })).toEqual([]);
    expect(getSlotsForDate({ snapshot: s, serviceId: CORTE, barberId: A, date: WED, now: NOW }).length).toBeGreaterThan(0);
  });

  it("bloqueo de otro barbero no afecta", () => {
    const time_off = [{ barber_id: B, starts_at: at(TUE, "00:00"), ends_at: at(WED, "00:00") }];
    expect(
      getSlotsForDate({ snapshot: snapshot({ time_off }), serviceId: CORTE, barberId: A, date: TUE, now: NOW }).length,
    ).toBe(30);
  });
});

describe("zona horaria", () => {
  it("las horas locales de Caracas se convierten a UTC-4", () => {
    const [first] = getSlotsForDate({ snapshot: snapshot(), serviceId: CORTE, barberId: A, date: TUE, now: NOW });
    expect(first.start).toBe("2026-11-03T13:00:00.000Z");
    expect(first.time).toBe("09:00");
  });

  it("'hoy' es el día de Caracas aunque en UTC ya sea mañana", () => {
    // Lunes 2 nov 22:00 en Caracas = martes 3 nov 02:00 UTC
    const lateMonday = new Date("2026-11-03T02:00:00Z");
    const days = getDaysAvailability({
      snapshot: snapshot({}, { max_days_ahead: 1 }),
      serviceId: CORTE,
      barberId: A,
      from: MON,
      days: 3,
      now: lateMonday,
    });
    // Ventana = lunes (hoy en Caracas) + 1 día ⇒ el martes es reservable, el miércoles no
    expect(days).toEqual([
      { date: MON, slots: 0 },
      { date: TUE, slots: 30 },
      { date: WED, slots: 0 },
    ]);
  });

  it("una cita guardada en UTC bloquea la hora local correcta", () => {
    const busy = [{ barber_id: A, starts_at: "2026-11-03T18:00:00Z", ends_at: "2026-11-03T18:30:00Z" }]; // 14:00 local
    const t = times(getSlotsForDate({ snapshot: snapshot({ busy }), serviceId: CORTE, barberId: A, date: TUE, now: NOW }));
    expect(t).not.toContain("14:00");
    expect(t).toContain("14:30");
  });
});

describe("anticipación mínima y ventana de días", () => {
  it("el mismo día solo ofrece turnos con al menos la anticipación mínima", () => {
    const now = new Date(at(TUE, "09:20")); // martes 9:20 local
    const t = times(getSlotsForDate({ snapshot: snapshot(), serviceId: CORTE, barberId: A, date: TUE, now }));
    expect(t[0]).toBe("10:30"); // 9:20 + 60 min = 10:20 ⇒ primer turno 10:30
    expect(t).not.toContain("10:15");
  });

  it("el turno exacto en el límite de anticipación sí se ofrece", () => {
    const now = new Date(at(TUE, "09:30"));
    expect(times(getSlotsForDate({ snapshot: snapshot(), serviceId: CORTE, barberId: A, date: TUE, now }))[0]).toBe("10:30");
  });

  it("anticipación configurable (0 = sin mínimo)", () => {
    const now = new Date(at(TUE, "09:20"));
    const t = times(getSlotsForDate({ snapshot: snapshot({}, { min_notice_min: 0 }), serviceId: CORTE, barberId: A, date: TUE, now }));
    expect(t[0]).toBe("09:30");
  });

  it("después del cierre no quedan turnos hoy", () => {
    const now = new Date(at(TUE, "17:45"));
    expect(getSlotsForDate({ snapshot: snapshot(), serviceId: CORTE, barberId: A, date: TUE, now })).toEqual([]);
  });

  it("fechas pasadas ⇒ sin turnos", () => {
    const now = new Date(at(WED, "08:00"));
    expect(getSlotsForDate({ snapshot: snapshot(), serviceId: CORTE, barberId: A, date: TUE, now })).toEqual([]);
  });

  it("respeta los días máximos hacia adelante", () => {
    const s = snapshot({}, { max_days_ahead: 8 });
    // MON + 8 = martes 10 nov (incluido); MON + 9 = miércoles 11 nov (excluido)
    expect(getSlotsForDate({ snapshot: s, serviceId: CORTE, barberId: A, date: "2026-11-10", now: NOW }).length).toBe(30);
    expect(getSlotsForDate({ snapshot: s, serviceId: CORTE, barberId: A, date: "2026-11-11", now: NOW })).toEqual([]);
  });
});

describe("cualquier barbero disponible", () => {
  it("une los turnos de todos los barberos que hacen el servicio", () => {
    const slots = getSlotsForDate({ snapshot: snapshot(), serviceId: CORTE, barberId: ANY_BARBER, date: TUE, now: NOW });
    const nine = slots.find((s) => s.time === "09:00")!;
    const ten = slots.find((s) => s.time === "10:00")!;
    expect(nine.barberIds).toEqual([A]); // B empieza a las 10
    expect(ten.barberIds).toEqual([A, B]);
    expect(times(slots)).toContain("13:00"); // A en pausa, B trabaja
  });

  it("si un barbero está ocupado, el turno sigue disponible con el otro", () => {
    const busy = [{ barber_id: A, starts_at: at(TUE, "10:00"), ends_at: at(TUE, "10:30") }];
    const ten = getSlotsForDate({ snapshot: snapshot({ busy }), serviceId: CORTE, barberId: ANY_BARBER, date: TUE, now: NOW }).find(
      (s) => s.time === "10:00",
    )!;
    expect(ten.barberIds).toEqual([B]);
  });

  it("solo considera barberos que hacen el servicio", () => {
    const slots = getSlotsForDate({ snapshot: snapshot(), serviceId: COLOR, barberId: ANY_BARBER, date: TUE, now: NOW });
    expect(slots.every((s) => s.barberIds.every((id) => id === B))).toBe(true);
  });

  it("reparte: primero el barbero con menos citas ese día", () => {
    const busy = [
      { barber_id: A, starts_at: at(TUE, "09:00"), ends_at: at(TUE, "09:30") },
      { barber_id: A, starts_at: at(TUE, "11:00"), ends_at: at(TUE, "11:30") },
      { barber_id: B, starts_at: at(TUE, "15:00"), ends_at: at(TUE, "15:30") },
    ];
    expect(rankBarbersForSlot(snapshot({ busy }), [A, B], TUE)).toEqual([B, A]);
    expect(rankBarbersForSlot(snapshot(), [B, A], TUE)).toEqual([A, B]); // empate ⇒ orden de aparición
  });
});

describe("días con disponibilidad (calendario)", () => {
  it("marca los días sin turnos para deshabilitarlos", () => {
    const days = getDaysAvailability({ snapshot: snapshot(), serviceId: CORTE, barberId: A, from: MON, days: 7, now: NOW });
    const map = Object.fromEntries(days.map((d) => [d.date, d.slots]));
    expect(map[MON]).toBe(0); // A no trabaja los lunes
    expect(map[TUE]).toBe(30);
    expect(map["2026-11-08"]).toBe(0); // domingo
  });
});
