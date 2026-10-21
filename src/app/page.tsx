import { ArrowRight, Clock, MapPin, Navigation, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Avatar } from "@/components/ui/Avatar";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/brand-icons";
import { formatUsd } from "@/lib/booking-links";
import { BUSINESS } from "@/lib/business";
import { whatsappUrl } from "@/lib/phone";
import { getCatalog, type WeeklyHours } from "@/lib/public-data";
import { formatTime12, toZonedParts, WEEKDAY_NAMES } from "@/lib/tz";

export const revalidate = 60;

const GALLERY = [
  { src: "/galeria/trabajo-1.jpg", alt: "Corte texturizado con taper fade y rizos definidos" },
  { src: "/galeria/trabajo-2.jpg", alt: "Corte crop con mid fade" },
];

// Lunes primero, domingo al final
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function todayStatus(hours: WeeklyHours[], tz: string) {
  const now = toZonedParts(new Date(), tz);
  const today = hours.find((h) => h.weekday === now.weekday);
  if (!today?.open || !today.close) return { open: false, label: "Hoy cerrado" };
  if (now.time < today.open) return { open: false, label: `Hoy abrimos a las ${formatTime12(today.open)}` };
  if (now.time >= today.close) return { open: false, label: "Ya cerramos por hoy" };
  return { open: true, label: `Abierto hoy hasta las ${formatTime12(today.close)}` };
}

export default async function HomePage() {
  const catalog = await getCatalog();
  const services = catalog?.snapshot.services ?? [];
  const barbers = catalog?.snapshot.barbers ?? [];
  const info = catalog?.info;
  const whatsapp = info?.whatsapp ?? BUSINESS.phone;
  const instagram = info?.instagram ?? BUSINESS.instagram;
  const tz = info?.timezone ?? BUSINESS.timezone;
  const hours = info?.weekly_hours ?? [];
  const status = hours.length ? todayStatus(hours, tz) : null;
  const todayWeekday = toZonedParts(new Date(), tz).weekday;
  const fromPrice = services.length ? Math.min(...services.map((s) => Number(s.price_usd))) : null;

  return (
    <>
      <SiteHeader whatsapp={whatsapp} />
      <main>
        {/* ---------------------------------------------------------------- Hero */}
        <section className="grain relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-14 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:pt-16 md:pb-20">
            <div>
              <p className="eyebrow">Baruta · Caracas</p>
              <h1 className="mt-4 text-[2.35rem] leading-[1.08] font-extrabold tracking-tight text-balance sm:text-5xl md:text-[3.5rem]">
                La mejor experiencia de barbería del <span className="gold-text">este de Caracas</span>.
              </h1>
              <p className="mt-5 max-w-md text-lg text-muted">
                Fades, cortes clásicos, barba y color en el C.C. Santa Fe. Reserva en menos de un minuto, sin esperar.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/reservar" className="btn-gold">
                  Reservar mi cita <ArrowRight className="size-4" />
                </Link>
                <a href={whatsappUrl(whatsapp, "¡Hola! Quiero información.")} target="_blank" rel="noopener" className="btn-ghost">
                  <WhatsAppIcon className="size-[18px]" /> Escríbenos
                </a>
              </div>
              {status && (
                <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted">
                  <span className={`size-2 rounded-full ${status.open ? "bg-ok shadow-[0_0_0_4px_rgb(111_191_138/0.15)]" : "bg-subtle"}`} />
                  {status.label}
                </p>
              )}
            </div>

            <div className="relative mx-auto w-full max-w-sm md:max-w-none">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-line">
                <Image
                  src="/galeria/trabajo-1.jpg"
                  alt="Corte realizado en Barber Suites"
                  fill
                  priority
                  sizes="(min-width: 768px) 40vw, 90vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-transparent to-transparent" />
                <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="eyebrow">Trabajos realizados</p>
                    <p className="mt-1 text-sm text-cream/90">Taper fade · textura natural</p>
                  </div>
                  {fromPrice !== null && (
                    <p className="rounded-full border border-gold/40 bg-ink/70 px-3 py-1.5 text-sm backdrop-blur">
                      Desde <span className="font-semibold text-gold-soft">{formatUsd(fromPrice)}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Datos rápidos */}
          <div className="relative border-y border-line bg-panel/50">
            <dl className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-line px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
              <QuickFact icon={<MapPin className="size-4" />} label="Dirección" value={BUSINESS.shortAddress} />
              <QuickFact icon={<Clock className="size-4" />} label="Horario" value={status?.label ?? "Martes 9:00 a. m. – 6:00 p. m."} />
              <QuickFact icon={<Phone className="size-4" />} label="WhatsApp" value={BUSINESS.phoneDisplay} href={whatsappUrl(whatsapp)} />
            </dl>
          </div>
        </section>

        {/* ----------------------------------------------------------- Servicios */}
        <section id="servicios" className="scroll-mt-20 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead eyebrow="Servicios" title="Lo que hacemos" note="Precios en USD. El pago se realiza en la barbería." />
            {services.length === 0 ? (
              <EmptyNote />
            ) : (
              <ul className="grid gap-x-12 md:grid-cols-2">
                {services.map((s) => (
                  <li key={s.id} className="border-b border-line">
                    <Link href={`/reservar?servicio=${s.id}`} className="group flex items-start gap-4 py-5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-3">
                          <h3 className="text-lg font-semibold transition group-hover:text-gold-soft">{s.name}</h3>
                          <span aria-hidden="true" className="mb-1 flex-1 border-b border-dotted border-line-strong" />
                          <span className="font-display text-lg font-semibold text-gold-soft">{formatUsd(s.price_usd)}</span>
                        </div>
                        {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-subtle">
                          <Clock className="size-3.5" /> {s.duration_min} min
                          <span className="ml-2 text-gold opacity-0 transition group-hover:opacity-100">Reservar →</span>
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------------ Barberos */}
        <section id="barberos" className="scroll-mt-20 border-t border-line bg-panel/30 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead eyebrow="El equipo" title="Nuestros barberos" />
            {barbers.length === 0 ? (
              <EmptyNote />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {barbers.map((b) => (
                  <article key={b.id} className="card flex flex-col p-5">
                    <div className="flex items-center gap-4">
                      <Avatar name={b.name} src={b.photo_url} size={72} />
                      <div>
                        <h3 className="text-lg font-semibold">{b.name}</h3>
                        <p className="text-sm text-subtle">
                          {b.service_ids.length} {b.service_ids.length === 1 ? "servicio" : "servicios"}
                        </p>
                      </div>
                    </div>
                    {b.bio && <p className="mt-4 flex-1 text-sm text-muted">{b.bio}</p>}
                    <Link href={`/reservar?barbero=${b.id}`} className="btn-ghost mt-5 !py-3 text-sm">
                      Reservar con {b.name.split(" ")[0]}
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------------ Trabajos */}
        <section id="trabajos" className="scroll-mt-20 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHead eyebrow="Portafolio" title="Trabajos realizados" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {GALLERY.map((g) => (
                <figure key={g.src} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line">
                  <Image src={g.src} alt={g.alt} fill sizes="(min-width: 768px) 33vw, 50vw" className="object-cover transition duration-500 hover:scale-[1.03]" />
                </figure>
              ))}
              {instagram && (
                <a
                  href={`https://instagram.com/${instagram}`}
                  target="_blank"
                  rel="noopener"
                  className="group col-span-2 flex aspect-[8/5] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gold/40 bg-panel p-6 text-center transition hover:border-gold md:col-span-1 md:aspect-[4/5]"
                >
                  <InstagramIcon className="size-8 text-gold" />
                  <p className="font-semibold">Mira más cortes en Instagram</p>
                  <p className="text-sm text-muted group-hover:text-cream">@{instagram}</p>
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- Reserva */}
        <section id="reservar" className="scroll-mt-20 border-t border-line bg-panel/30 py-16 sm:py-20">
          <div className="mx-auto max-w-2xl px-4 sm:px-6">
            <SectionHead eyebrow="Reserva en línea" title="Aparta tu turno" note="Elige barbero, servicio, día y hora. Te confirmamos al instante." />
            <BookingFlow
              barbers={barbers}
              services={services}
              maxDaysAhead={info?.max_days_ahead ?? 30}
              timezone={tz}
              whatsapp={whatsapp}
            />
          </div>
        </section>

        {/* --------------------------------------------------- Horario y mapa */}
        <section id="visitanos" className="scroll-mt-20 py-16 sm:py-20">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6 md:grid-cols-2">
            <div>
              <SectionHead eyebrow="Visítanos" title="Horario y ubicación" />
              <div className="card divide-y divide-line">
                {WEEK_ORDER.map((wd) => {
                  const h = hours.find((x) => x.weekday === wd);
                  const isToday = wd === todayWeekday;
                  return (
                    <div key={wd} className={`flex items-center justify-between px-5 py-3.5 text-sm ${isToday ? "bg-gold/[0.06]" : ""}`}>
                      <span className={isToday ? "font-semibold text-cream" : "text-muted"}>
                        {WEEKDAY_NAMES[wd]}
                        {isToday && <span className="ml-2 text-xs font-medium text-gold">Hoy</span>}
                      </span>
                      <span className={`tabular-nums ${h?.open ? "text-cream" : "text-subtle"}`}>
                        {h?.open && h.close ? `${formatTime12(h.open)} – ${formatTime12(h.close)}` : hours.length ? "Cerrado" : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-subtle">El horario puede variar según la disponibilidad de cada barbero.</p>
            </div>
            <div className="flex flex-col">
              <div className="card overflow-hidden">
                <iframe
                  title="Mapa: Centro Comercial Santa Fe, Baruta"
                  src={BUSINESS.mapsEmbed}
                  className="h-64 w-full grayscale invert-[0.9] hue-rotate-180 md:h-72"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                <div className="p-5">
                  <p className="font-semibold">Centro Comercial Santa Fe</p>
                  <p className="mt-1 text-sm text-muted">Nivel C3, Local #20 · Baruta, Caracas</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <a href={BUSINESS.mapsUrl} target="_blank" rel="noopener" className="btn-ghost !py-3 text-sm">
                      <Navigation className="size-4" /> Cómo llegar
                    </a>
                    <a href={`tel:${BUSINESS.phone}`} className="btn-ghost !py-3 text-sm">
                      <Phone className="size-4" /> Llamar
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter whatsapp={whatsapp} instagram={instagram} />

      {/* Barra fija en móvil */}
      <div className="h-20 md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
        <div className="flex gap-2">
          <a
            href={whatsappUrl(whatsapp, "¡Hola! Quiero información.")}
            target="_blank"
            rel="noopener"
            aria-label="WhatsApp"
            className="grid size-12 shrink-0 place-items-center rounded-full border border-line-strong"
          >
            <WhatsAppIcon />
          </a>
          <Link href="/reservar" className="btn-gold flex-1">
            Reservar mi cita
          </Link>
        </div>
      </div>
    </>
  );
}

function SectionHead({ eyebrow, title, note }: { eyebrow: string; title: string; note?: string }) {
  return (
    <div className="mb-8">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {note && <p className="mt-2 text-muted">{note}</p>}
    </div>
  );
}

function QuickFact({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  return (
    <div className="py-4 sm:px-6 sm:first:pl-0">
      <dt className="flex items-center gap-2 text-xs tracking-wider text-subtle uppercase">
        <span className="text-gold">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-cream">
        {href ? (
          <a href={href} target="_blank" rel="noopener" className="hover:text-gold-soft">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

function EmptyNote() {
  return <p className="card p-6 text-muted">Muy pronto publicaremos esta información. Mientras tanto, escríbenos por WhatsApp.</p>;
}
