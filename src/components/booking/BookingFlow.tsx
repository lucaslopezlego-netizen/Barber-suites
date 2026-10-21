"use client";

import { AlertTriangle, ArrowLeft, CalendarPlus, Check, Clock, Loader2, RotateCcw, Scissors, Sparkles, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ANY_BARBER, type SnapshotBarber, type SnapshotService } from "@/lib/availability";
import { bookingIcs, bookingWhatsappMessage, formatUsd, type BookingSummary } from "@/lib/booking-links";
import { BOOKING_ERRORS } from "@/lib/booking-errors";
import { isValidPhone, whatsappUrl } from "@/lib/phone";
import { addDays, formatDateLong, formatInstantTime, formatTime12, timeToMinutes, todayIn, toZonedParts } from "@/lib/tz";
import { Avatar } from "@/components/ui/Avatar";
import { WhatsAppIcon } from "@/components/ui/brand-icons";
import { Calendar } from "./Calendar";

interface Props {
  barbers: SnapshotBarber[];
  services: SnapshotService[];
  maxDaysAhead: number;
  timezone: string;
  whatsapp: string;
  initialBarberId?: string;
  initialServiceId?: string;
}

type Step = 1 | 2 | 3 | 4 | 5 | 6;
const STEP_LABELS = ["Barbero", "Servicio", "Fecha", "Hora", "Tus datos"];
const MAX_FETCH_DAYS = 62;

interface SlotOption {
  start: string;
  time: string;
}

export function BookingFlow(props: Props) {
  const { barbers, services, timezone, whatsapp } = props;
  const today = useMemo(() => todayIn(timezone), [timezone]);
  const lastDay = addDays(today, Math.min(props.maxDaysAhead, MAX_FETCH_DAYS - 1));

  const validInitialBarber =
    props.initialBarberId && (props.initialBarberId === ANY_BARBER || barbers.some((b) => b.id === props.initialBarberId))
      ? props.initialBarberId
      : null;
  const validInitialService = props.initialServiceId && services.some((s) => s.id === props.initialServiceId) ? props.initialServiceId : null;

  const [step, setStep] = useState<Step>(validInitialBarber ? 2 : 1);
  const [barberId, setBarberId] = useState<string | null>(validInitialBarber);
  const [serviceId, setServiceId] = useState<string | null>(validInitialService);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotOption | null>(null);

  const [days, setDays] = useState<Record<string, number> | undefined>(undefined);
  const [daysError, setDaysError] = useState(false);
  const [slots, setSlots] = useState<SlotOption[] | undefined>(undefined);
  const [slotsError, setSlotsError] = useState(false);

  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "", website: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const startedAt = useRef<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingSummary | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const service = services.find((s) => s.id === serviceId) ?? null;

  // Servicios disponibles según el barbero elegido
  const availableServices = useMemo(() => {
    if (!barberId) return services;
    const ids = new Set(barberId === ANY_BARBER ? barbers.flatMap((b) => b.service_ids) : (barber?.service_ids ?? []));
    return services.filter((s) => ids.has(s.id));
  }, [barberId, barber, barbers, services]);

  // Si el servicio preseleccionado no lo hace el barbero, se descarta
  useEffect(() => {
    if (serviceId && barberId && !availableServices.some((s) => s.id === serviceId)) setServiceId(null);
  }, [availableServices, serviceId, barberId]);

  const goTo = useCallback((s: Step) => {
    setStep(s);
    requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }, []);

  // ---- Carga de días con disponibilidad
  const loadDays = useCallback(async () => {
    if (!barberId || !serviceId) return;
    setDays(undefined);
    setDaysError(false);
    const n = Math.min(props.maxDaysAhead + 1, MAX_FETCH_DAYS);
    try {
      const res = await fetch(`/api/disponibilidad?servicio=${serviceId}&barbero=${barberId}&desde=${today}&dias=${n}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { days: { date: string; slots: number }[] };
      setDays(Object.fromEntries(json.days.map((d) => [d.date, d.slots])));
    } catch {
      setDaysError(true);
    }
  }, [barberId, serviceId, today, props.maxDaysAhead]);

  useEffect(() => {
    if (step === 3) void loadDays();
  }, [step, loadDays]);

  // ---- Carga de turnos del día elegido
  const loadSlots = useCallback(async () => {
    if (!barberId || !serviceId || !date) return;
    setSlots(undefined);
    setSlotsError(false);
    try {
      const res = await fetch(`/api/disponibilidad?servicio=${serviceId}&barbero=${barberId}&fecha=${date}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { slots: SlotOption[] };
      setSlots(json.slots);
    } catch {
      setSlotsError(true);
    }
  }, [barberId, serviceId, date]);

  useEffect(() => {
    if (step === 4) void loadSlots();
  }, [step, loadSlots]);

  useEffect(() => {
    if (step === 5 && !startedAt.current) startedAt.current = Date.now();
  }, [step]);

  // ---- Envío
  const nameOk = form.name.trim().length >= 2;
  const phoneOk = isValidPhone(form.phone);
  const emailOk = !form.email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, phone: true, email: true });
    if (!nameOk || !phoneOk || !emailOk || !slot || !barberId || !serviceId) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch("/api/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId,
          serviceId,
          start: slot.start,
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          notes: form.notes.trim(),
          website: form.website,
          startedAt: startedAt.current,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setBooking(json.booking as BookingSummary);
        goTo(6);
        return;
      }
      const code = (json.error as string) ?? "SERVER_ERROR";
      const message = (json.message as string) ?? BOOKING_ERRORS.SERVER_ERROR;
      if (["SLOT_TAKEN", "TOO_SOON", "OUTSIDE_HOURS", "TIME_OFF"].includes(code)) {
        // Alguien tomó el turno mientras el cliente reservaba: volver a las horas
        setNotice(message);
        setSlot(null);
        goTo(4);
        void loadSlots();
        return;
      }
      setNotice(message);
    } catch {
      setNotice("Sin conexión. Revisa tu internet e inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setStep(1);
    setBarberId(null);
    setServiceId(null);
    setDate(null);
    setSlot(null);
    setBooking(null);
    setNotice(null);
    setForm((f) => ({ ...f, notes: "" }));
    startedAt.current = 0;
    requestAnimationFrame(() => rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function downloadIcs() {
    if (!booking) return;
    const blob = new Blob([bookingIcs(booking)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cita-barber-suites.ics";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const groupedSlots = useMemo(() => {
    const groups: { label: string; items: SlotOption[] }[] = [
      { label: "Mañana", items: [] },
      { label: "Tarde", items: [] },
      { label: "Noche", items: [] },
    ];
    for (const s of slots ?? []) {
      const m = timeToMinutes(s.time);
      groups[m < 12 * 60 ? 0 : m < 18 * 60 ? 1 : 2].items.push(s);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [slots]);

  if (barbers.length === 0 || services.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-muted">Las reservas en línea estarán disponibles muy pronto.</p>
        <a href={whatsappUrl(whatsapp, "¡Hola! Quiero reservar una cita.")} className="btn-primary mt-5" target="_blank" rel="noopener">
          <WhatsAppIcon /> Reservar por WhatsApp
        </a>
      </div>
    );
  }

  const barberLabel = barberId === ANY_BARBER ? "Cualquier barbero" : barber?.name;

  return (
    <div ref={rootRef} className="scroll-mt-24">
      {step < 6 && (
        <>
          {/* Progreso */}
          <ol className="mb-5 flex items-center gap-1.5" aria-label="Pasos de la reserva">
            {STEP_LABELS.map((label, i) => {
              const n = (i + 1) as Step;
              const done = n < step;
              const current = n === step;
              return (
                <li key={label} className="flex-1">
                  <button
                    type="button"
                    disabled={!done}
                    onClick={() => goTo(n)}
                    aria-current={current ? "step" : undefined}
                    className="group w-full text-left disabled:cursor-default"
                  >
                    <span
                      className={`block h-1 rounded-full transition-colors ${current ? "bg-onyx" : done ? "bg-gold group-hover:bg-onyx" : "bg-line"}`}
                    />
                    <span className={`mt-2 hidden text-xs sm:block ${current ? "text-fg" : "text-subtle"}`}>{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Resumen de lo elegido */}
          {(barberLabel || service || date) && (
            <div className="mb-5 flex flex-wrap gap-2 text-sm">
              {barberLabel && <Chip onClick={() => goTo(1)} icon={<Users className="size-3.5" />} text={barberLabel} />}
              {service && <Chip onClick={() => goTo(2)} icon={<Scissors className="size-3.5" />} text={`${service.name}, ${formatUsd(service.price_usd)}`} />}
              {date && step > 3 && <Chip onClick={() => goTo(3)} icon={<CalendarPlus className="size-3.5" />} text={formatDateLong(date)} />}
              {slot && step > 4 && <Chip onClick={() => goTo(4)} icon={<Clock className="size-3.5" />} text={formatTime12(slot.time)} />}
            </div>
          )}
        </>
      )}

      {notice && step !== 6 && (
        <div role="alert" className="animate-rise mb-5 flex gap-3 rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-fg">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" />
          <p>{notice}</p>
        </div>
      )}

      {/* Paso 1: barbero */}
      {step === 1 && (
        <section className="animate-rise" aria-labelledby="step-title">
          <StepTitle ref={headingRef} n={1} title="¿Con quién te quieres atender?" />
          <div className="grid gap-3 sm:grid-cols-2">
            <OptionCard
              selected={barberId === ANY_BARBER}
              onClick={() => {
                setBarberId(ANY_BARBER);
                setDate(null);
                setSlot(null);
                goTo(serviceId && barbers.some((b) => b.service_ids.includes(serviceId)) ? 3 : 2);
              }}
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-full border border-dashed border-gold/60 text-gold">
                <Sparkles className="size-6" />
              </span>
              <span>
                <span className="block font-semibold">Cualquier barbero disponible</span>
                <span className="mt-0.5 block text-sm text-muted">Más horarios para elegir</span>
              </span>
            </OptionCard>
            {barbers.map((b) => (
              <OptionCard
                key={b.id}
                selected={barberId === b.id}
                onClick={() => {
                  setBarberId(b.id);
                  setDate(null);
                  setSlot(null);
                  goTo(serviceId && b.service_ids.includes(serviceId) ? 3 : 2);
                }}
              >
                <Avatar name={b.name} src={b.photo_url} size={56} />
                <span className="min-w-0">
                  <span className="block font-semibold">{b.name}</span>
                  {b.bio && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{b.bio}</span>}
                </span>
              </OptionCard>
            ))}
          </div>
        </section>
      )}

      {/* Paso 2: servicio */}
      {step === 2 && (
        <section className="animate-rise" aria-labelledby="step-title">
          <StepTitle ref={headingRef} n={2} title="¿Qué servicio quieres?" />
          {availableServices.length === 0 ? (
            <p className="card p-5 text-muted">Este barbero no tiene servicios disponibles ahora mismo. Prueba con otro.</p>
          ) : (
            <div className="grid gap-3">
              {availableServices.map((s) => (
                <OptionCard
                  key={s.id}
                  selected={serviceId === s.id}
                  onClick={() => {
                    setServiceId(s.id);
                    setDate(null);
                    setSlot(null);
                    goTo(3);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{s.name}</span>
                    {s.description && <span className="mt-0.5 block text-sm text-muted">{s.description}</span>}
                    <span className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted">
                      <Clock className="size-3.5" /> {s.duration_min} min
                    </span>
                  </span>
                  <span className="font-display text-xl font-semibold text-gold-strong">{formatUsd(s.price_usd)}</span>
                </OptionCard>
              ))}
            </div>
          )}
          <BackButton onClick={() => goTo(1)} />
        </section>
      )}

      {/* Paso 3: fecha */}
      {step === 3 && (
        <section className="animate-rise" aria-labelledby="step-title">
          <StepTitle ref={headingRef} n={3} title="Elige el día" />
          {daysError ? (
            <RetryBox onRetry={loadDays} text="No pudimos cargar los días disponibles." />
          ) : (
            <>
              <Calendar
                today={today}
                lastDay={lastDay}
                availability={days}
                selected={date}
                onSelect={(d) => {
                  setDate(d);
                  setSlot(null);
                  setNotice(null);
                  goTo(4);
                }}
              />
              {days && Object.values(days).every((n) => n === 0) && (
                <p className="mt-4 text-sm text-muted">
                  No hay horarios libres en los próximos días.{" "}
                  {barberId !== ANY_BARBER && (
                    <button type="button" className="text-gold underline underline-offset-4" onClick={() => setBarberId(ANY_BARBER)}>
                      Prueba con cualquier barbero
                    </button>
                  )}
                </p>
              )}
            </>
          )}
          <BackButton onClick={() => goTo(2)} />
        </section>
      )}

      {/* Paso 4: hora */}
      {step === 4 && date && (
        <section className="animate-rise" aria-labelledby="step-title">
          <StepTitle ref={headingRef} n={4} title="Elige la hora" subtitle={formatDateLong(date)} />
          {slotsError ? (
            <RetryBox onRetry={loadSlots} text="No pudimos cargar los horarios." />
          ) : slots === undefined ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy="true" aria-label="Cargando horarios">
              {Array.from({ length: 12 }, (_, i) => (
                <span key={i} className="h-12 animate-pulse rounded-xl bg-surface-2" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="card p-5 text-center">
              <p className="text-muted">Ya no quedan horarios libres este día.</p>
              <button type="button" className="btn-secondary mt-4" onClick={() => goTo(3)}>
                Elegir otro día
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedSlots.map((g) => (
                <div key={g.label}>
                  <p className="mb-2 text-sm font-medium text-muted">{g.label}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {g.items.map((s) => (
                      <button
                        key={s.start}
                        type="button"
                        aria-pressed={slot?.start === s.start}
                        onClick={() => {
                          setSlot(s);
                          setNotice(null);
                          goTo(5);
                        }}
                        className={`h-12 rounded-xl border text-[15px] font-semibold tabular-nums transition ${
                          slot?.start === s.start
                            ? "border-onyx bg-onyx text-white"
                            : "border-line-strong bg-page text-fg hover:border-onyx"
                        }`}
                      >
                        {formatTime12(s.time)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <BackButton onClick={() => goTo(3)} />
        </section>
      )}

      {/* Paso 5: datos */}
      {step === 5 && slot && service && (
        <section className="animate-rise" aria-labelledby="step-title">
          <StepTitle ref={headingRef} n={5} title="Tus datos" subtitle="Solo los usamos para tu cita." />
          <form onSubmit={submit} noValidate className="space-y-4">
            <div>
              <label htmlFor="bk-name" className="label">
                Nombre y apellido
              </label>
              <input
                id="bk-name"
                className="field"
                autoComplete="name"
                value={form.name}
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onBlur={() => setTouched({ ...touched, name: true })}
                aria-invalid={touched.name && !nameOk}
                aria-describedby="bk-name-err"
              />
              {touched.name && !nameOk && (
                <p id="bk-name-err" className="mt-1.5 text-sm text-danger">
                  Escribe tu nombre.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="bk-phone" className="label">
                Teléfono / WhatsApp
              </label>
              <input
                id="bk-phone"
                className="field"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="0414-1234567"
                value={form.phone}
                maxLength={20}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                onBlur={() => setTouched({ ...touched, phone: true })}
                aria-invalid={touched.phone && !phoneOk}
                aria-describedby="bk-phone-err"
              />
              {touched.phone && !phoneOk && (
                <p id="bk-phone-err" className="mt-1.5 text-sm text-danger">
                  Revisa el número. Ejemplo: 0414-1234567
                </p>
              )}
            </div>
            <div>
              <label htmlFor="bk-email" className="label">
                Email <span className="font-normal text-subtle">(opcional)</span>
              </label>
              <input
                id="bk-email"
                className="field"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                maxLength={120}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                onBlur={() => setTouched({ ...touched, email: true })}
                aria-invalid={touched.email && !emailOk}
              />
              {touched.email && !emailOk && <p className="mt-1.5 text-sm text-danger">Ese email no parece válido.</p>}
            </div>
            <div>
              <label htmlFor="bk-notes" className="label">
                Nota para el barbero <span className="font-normal text-subtle">(opcional)</span>
              </label>
              <textarea
                id="bk-notes"
                className="field min-h-20 resize-y"
                maxLength={500}
                placeholder="Ej.: quiero el degradado bajo"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {/* Honeypot anti-spam: invisible para personas */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="bk-website">Sitio web</label>
              <input
                id="bk-website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </div>

            <div className="card mt-2 space-y-2 p-4 text-sm">
              <SummaryRow label="Servicio" value={`${service.name} (${service.duration_min} min)`} />
              <SummaryRow label="Barbero" value={barberLabel ?? ""} />
              <SummaryRow label="Fecha" value={formatDateLong(date!)} />
              <SummaryRow label="Hora" value={formatTime12(slot.time)} />
              <div className="flex items-center justify-between border-t border-line pt-2">
                <span className="text-muted">Total</span>
                <span className="font-display text-lg font-semibold text-gold-strong">{formatUsd(service.price_usd)}</span>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-5 animate-spin" /> Reservando…
                </>
              ) : (
                "Confirmar reserva"
              )}
            </button>
            <p className="text-center text-xs text-subtle">El pago se realiza en la barbería.</p>
          </form>
          <BackButton onClick={() => goTo(4)} />
        </section>
      )}

      {/* Paso 6: confirmación */}
      {step === 6 && booking && (
        <section className="animate-rise text-center" aria-labelledby="step-title">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-gold/15 text-gold ring-1 ring-gold/40">
            <Check className="size-8" strokeWidth={2.5} />
          </span>
          <h3 id="step-title" ref={headingRef} tabIndex={-1} className="mt-5 text-2xl font-bold outline-none sm:text-3xl">
            ¡Reserva recibida!
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-muted">
            Te esperamos el <span className="text-fg">{formatDateLong(toZonedParts(booking.starts_at, timezone).date)}</span> a las{" "}
            <span className="text-fg">{formatInstantTime(booking.starts_at, timezone)}</span>
          </p>

          <div className="card mx-auto mt-6 max-w-md space-y-2 p-5 text-left text-sm">
            <SummaryRow label="Servicio" value={booking.service.name} />
            <SummaryRow label="Barbero" value={booking.barber.name} />
            <SummaryRow label="Fecha" value={formatDateLong(toZonedParts(booking.starts_at, timezone).date)} />
            <SummaryRow label="Hora" value={`${formatInstantTime(booking.starts_at, timezone)} – ${formatInstantTime(booking.ends_at, timezone)}`} />
            <SummaryRow label="Precio" value={formatUsd(booking.service.price_usd)} />
            <SummaryRow label="Código" value={booking.id.slice(0, 8).toUpperCase()} mono />
          </div>

          <div className="mx-auto mt-6 grid max-w-md gap-3">
            <a href={whatsappUrl(whatsapp, bookingWhatsappMessage(booking, timezone))} target="_blank" rel="noopener" className="btn-primary">
              <WhatsAppIcon /> Escribir a la barbería por WhatsApp
            </a>
            <button type="button" onClick={downloadIcs} className="btn-secondary">
              <CalendarPlus className="size-5" /> Agregar a mi calendario
            </button>
            <button type="button" onClick={restart} className="mt-1 inline-flex items-center justify-center gap-2 text-sm text-muted hover:text-fg">
              <RotateCcw className="size-4" /> Hacer otra reserva
            </button>
          </div>
          <p className="mx-auto mt-6 max-w-sm text-xs text-subtle">
            Si no puedes asistir, avísanos por WhatsApp para liberar el turno.
          </p>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Chip({ icon, text, onClick }: { icon: React.ReactNode; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-fg transition hover:border-gold/60"
    >
      <span className="text-gold">{icon}</span>
      <span className="truncate">{text}</span>
    </button>
  );
}

function StepTitle({ n, title, subtitle, ref }: { n: number; title: string; subtitle?: string; ref: React.Ref<HTMLHeadingElement> }) {
  return (
    <div className="mb-4">
      <p className="text-sm text-subtle">Paso {n} de 5</p>
      <h3 id="step-title" ref={ref} tabIndex={-1} className="mt-1 text-xl font-bold outline-none sm:text-2xl">
        {title}
      </h3>
      {subtitle && <p className="mt-1 text-muted first-letter:uppercase">{subtitle}</p>}
    </div>
  );
}

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
        selected ? "border-onyx bg-surface" : "border-line bg-page hover:border-onyx/40"
      }`}
    >
      {children}
    </button>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-6 inline-flex items-center gap-2 text-sm text-muted transition hover:text-fg">
      <ArrowLeft className="size-4" /> Volver
    </button>
  );
}

function RetryBox({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-center gap-3 p-6 text-center">
      <AlertTriangle className="size-6 text-warn" />
      <p className="text-muted">{text}</p>
      <button type="button" className="btn-secondary" onClick={onRetry}>
        <RotateCcw className="size-4" /> Reintentar
      </button>
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className={`text-right font-medium text-fg first-letter:uppercase ${mono ? "font-mono tracking-wider" : ""}`}>{value}</span>
    </div>
  );
}
