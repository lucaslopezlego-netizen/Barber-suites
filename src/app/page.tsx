import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { InstagramIcon, WhatsAppIcon } from "@/components/ui/brand-icons";
import { formatUsd } from "@/lib/booking-links";
import { BUSINESS } from "@/lib/business";
import { whatsappUrl } from "@/lib/phone";
import { getCatalog, type WeeklyHours } from "@/lib/public-data";
import { formatRangeShort, formatTime12, toZonedParts, WEEKDAY_NAMES } from "@/lib/tz";

export const revalidate = 60;

const GALLERY = [
  { src: "/galeria/trabajo-1.jpg", alt: "Corte texturizado con taper fade y rizos definidos" },
  { src: "/galeria/trabajo-2.jpg", alt: "Corte crop con mid fade" },
];

// Mismo ancho y márgenes en todas las secciones
const CONTAINER = "mx-auto max-w-6xl px-4 sm:px-6";

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
  // Quién atiende cada día (nombres en el orden de la web)
  const workingHours = catalog?.snapshot.working_hours ?? [];
  const barbersOn = (weekday: number) =>
    barbers.filter((b) => workingHours.some((w) => w.barber_id === b.id && w.weekday === weekday)).map((b) => b.name);
  const fromPrice = services.length ? Math.min(...services.map((s) => Number(s.price_usd))) : null;

  return (
    <>
      <SiteHeader whatsapp={whatsapp} />
      <main>
        {/* ---------------------------------------------------------------- Portada */}
        <section className="border-b border-line">
          <div className={`${CONTAINER} grid items-center gap-10 pt-10 pb-12 md:grid-cols-12 md:gap-8 md:pt-16 md:pb-20`}>
            <div className="md:col-span-7">
              <h1 className="title-display text-[2.1rem] leading-[1.12] text-balance sm:text-5xl md:text-[3.4rem]">
                La mejor experiencia de barbería del este de Caracas
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
                Fades, cortes clásicos, barba y color en el Centro Comercial Santa Fe, Baruta. Elige barbero y hora en menos de un minuto.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/reservar" className="btn-primary">
                  Reservar mi cita
                </Link>
                <a href={whatsappUrl(whatsapp, "¡Hola! Quiero información.")} target="_blank" rel="noopener" className="btn-secondary">
                  <WhatsAppIcon className="size-[18px]" /> Escríbenos
                </a>
              </div>
              {status && (
                <p className="mt-6 inline-flex items-center gap-2 text-sm text-muted">
                  <span className={`size-2 rounded-full ${status.open ? "bg-ok" : "bg-subtle"}`} />
                  {status.label}
                </p>
              )}
            </div>

            {/* La foto va en un marco de espejo de barbería: arco arriba y filete dorado */}
            <figure className="mx-auto w-full max-w-sm md:col-span-5 md:max-w-none">
              <div className="rounded-t-[999px] rounded-b-2xl border border-gold/50 p-2">
                <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-xl bg-surface">
                  <Image
                    src="/galeria/trabajo-1.jpg"
                    alt="Taper fade con textura natural, hecho en Barber Suites"
                    fill
                    priority
                    sizes="(min-width: 768px) 40vw, 90vw"
                    className="object-cover"
                  />
                </div>
              </div>
              <figcaption className="mt-3 flex items-baseline justify-between gap-3 px-1 text-sm text-muted">
                <span>Taper fade con textura natural</span>
                {fromPrice !== null && (
                  <span>
                    Desde <span className="font-display font-semibold text-gold-strong">{formatUsd(fromPrice)}</span>
                  </span>
                )}
              </figcaption>
            </figure>
          </div>

          {/* Datos rápidos */}
          <div className="border-t border-line bg-surface">
            <dl className={`${CONTAINER} grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0`}>
              <QuickFact icon={<MapPin className="size-4" />} label="Dirección" value={BUSINESS.shortAddress} />
              <QuickFact icon={<Clock className="size-4" />} label="Horario de hoy" value={status?.label ?? "Martes de 9:00 a. m. a 6:00 p. m."} />
              <QuickFact icon={<Phone className="size-4" />} label="WhatsApp" value={BUSINESS.phoneDisplay} href={whatsappUrl(whatsapp)} />
            </dl>
          </div>
        </section>

        {/* ---------------------------------------------------------------- Precios */}
        <Section id="precios" title="Precios" note="Toca un servicio para reservarlo. Los precios están en dólares y se pagan en la barbería.">
          {services.length === 0 ? (
            <EmptyNote />
          ) : (
            /* Tablero de precios: un letrero de cuero negro sobre la pared blanca. La pieza protagonista. */
            <div className="leather rounded-[1.75rem] p-2 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.45)]">
              <div className="relative rounded-[1.4rem] border border-gold-light/35 px-5 py-8 sm:px-12 sm:py-12">
                <div className="flex items-center justify-center gap-4">
                  <span aria-hidden="true" className="h-px w-10 bg-gold-light/50 sm:w-20" />
                  <Image src="/logo.png" alt="Barber Suites" width={72} height={72} className="size-[72px]" />
                  <span aria-hidden="true" className="h-px w-10 bg-gold-light/50 sm:w-20" />
                </div>
                <ul className="mt-8 grid gap-x-14 md:grid-cols-2">
                  {services.map((s) => (
                    <li key={s.id}>
                      <Link href={`/reservar?servicio=${s.id}`} className="group block rounded-lg py-4" aria-label={`Reservar ${s.name}, ${formatUsd(s.price_usd)}`}>
                        <div className="flex items-baseline gap-3">
                          <h3 className="text-lg font-semibold text-white transition group-hover:text-gold-light sm:text-xl">{s.name}</h3>
                          <span aria-hidden="true" className="mb-1.5 flex-1 border-b-2 border-dotted border-gold-light/30" />
                          <span className="font-display text-2xl font-semibold text-gold-light tabular-nums">{formatUsd(s.price_usd)}</span>
                        </div>
                        <p className="mt-1 text-sm text-white/65">
                          {s.description ? `${s.description} ` : ""}
                          <span className="whitespace-nowrap text-white/45">{s.duration_min} min</span>
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Section>

        {/* --------------------------------------------------------------- Barberos */}
        <Section id="barberos" tone="surface" title="Barberos" note="Elige con quién atenderte o deja que te asignemos al primero libre.">
          {barbers.length === 0 ? (
            <EmptyNote />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 lg:grid-cols-3">
              {barbers.map((b) => (
                <article key={b.id}>
                  <Link href={`/reservar?barbero=${b.id}`} className="group block">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-t-[999px] rounded-b-xl border border-line bg-page">
                      {b.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.photo_url} alt={b.name} className="size-full object-cover" />
                      ) : (
                        <span aria-hidden="true" className="grid size-full place-items-center font-display text-5xl text-gold">
                          {initials(b.name)}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold text-onyx group-hover:text-gold-strong">{b.name}</h3>
                  </Link>
                  {b.bio && <p className="mt-1 line-clamp-3 text-sm text-muted">{b.bio}</p>}
                  <Link
                    href={`/reservar?barbero=${b.id}`}
                    className="mt-3 inline-block text-sm font-semibold text-gold underline decoration-gold/40 underline-offset-4 hover:decoration-gold"
                  >
                    Reservar con {b.name.split(" ")[0]}
                  </Link>
                </article>
              ))}
            </div>
          )}
        </Section>

        {/* --------------------------------------------------------------- Trabajos */}
        <Section id="trabajos" title="Trabajos realizados" note="Cortes hechos en la barbería. Hay más en nuestro Instagram.">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
            {GALLERY.map((g) => (
              <figure key={g.src} className="relative aspect-[4/5] overflow-hidden rounded-xl border border-line">
                <Image src={g.src} alt={g.alt} fill sizes="(min-width: 768px) 33vw, 50vw" className="object-cover" />
              </figure>
            ))}
            {instagram && (
              <a
                href={`https://instagram.com/${instagram}`}
                target="_blank"
                rel="noopener"
                className="col-span-2 flex aspect-[8/5] flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface p-6 text-center transition hover:border-onyx md:col-span-1 md:aspect-[4/5]"
              >
                <InstagramIcon className="size-8 text-gold" />
                <p className="font-semibold">Ver más cortes en Instagram</p>
                <p className="text-sm text-muted">@{instagram}</p>
              </a>
            )}
          </div>
        </Section>

        {/* ---------------------------------------------------------------- Reserva */}
        <Section id="reservar" tone="surface" title="Reserva tu cita" note="Barbero, servicio, día y hora. Te toma menos de un minuto y recibes la confirmación en pantalla.">
          <div className="max-w-2xl">
            <BookingFlow
              barbers={barbers}
              services={services}
              maxDaysAhead={info?.max_days_ahead ?? 30}
              timezone={tz}
              whatsapp={whatsapp}
            />
          </div>
        </Section>

        {/* ------------------------------------------------------------- Visítanos */}
        <Section id="visitanos" title="Horario y ubicación" note="Centro Comercial Santa Fe, nivel C3, local 20, Baruta.">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="self-start">
              <ul className="card divide-y divide-line">
                {WEEK_ORDER.map((wd) => {
                  const h = hours.find((x) => x.weekday === wd);
                  const isToday = wd === todayWeekday;
                  const team = barbersOn(wd);
                  return (
                    <li key={wd} className={`grid grid-cols-[6.5rem_1fr] gap-x-4 px-5 py-3.5 text-sm ${isToday ? "bg-surface" : ""}`}>
                      <span className={isToday ? "font-semibold text-onyx" : "text-muted"}>
                        {WEEKDAY_NAMES[wd]}
                        {isToday && <span className="ml-2 text-xs font-semibold text-gold">hoy</span>}
                      </span>
                      <span>
                        <span className={`block tabular-nums ${h?.open ? "text-fg" : "text-subtle"}`}>
                          {h?.open && h.close ? formatRangeShort(h.open, h.close) : hours.length ? "Cerrado" : "Por confirmar"}
                        </span>
                        {team.length > 0 && (
                          <span className="mt-0.5 block text-xs text-subtle">
                            {team.length === barbers.length && barbers.length > 1 ? "Todo el equipo" : team.join(", ")}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-xs text-subtle">Debajo de cada día ves quién atiende. Para ver las horas libres de cada barbero, usa la reserva.</p>
            </div>
            <div className="card self-start overflow-hidden">
              <iframe
                title="Mapa: Centro Comercial Santa Fe, Baruta"
                src={BUSINESS.mapsEmbed}
                className="h-64 w-full bg-surface grayscale md:h-72"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="grid grid-cols-2 gap-2 p-4">
                <a href={BUSINESS.mapsUrl} target="_blank" rel="noopener" className="btn-secondary !py-3 text-sm">
                  <Navigation className="size-4" /> Cómo llegar
                </a>
                <a href={`tel:${BUSINESS.phone}`} className="btn-secondary !py-3 text-sm">
                  <Phone className="size-4" /> Llamar
                </a>
              </div>
            </div>
          </div>
        </Section>
      </main>
      <SiteFooter whatsapp={whatsapp} instagram={instagram} />

      {/* Barra fija en móvil */}
      <div className="h-20 md:hidden" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-page/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
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
          <Link href="/reservar" className="btn-primary flex-1">
            Reservar mi cita
          </Link>
        </div>
      </div>
    </>
  );
}

function initials(name: string) {
  return name
    .replace(/\(.*?\)/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * Todas las secciones comparten la misma estructura para dar orden:
 * título en Cinzel a la izquierda y una nota corta al lado (debajo en móvil).
 */
function Section({
  id,
  title,
  note,
  tone = "page",
  children,
}: {
  id: string;
  title: string;
  note?: string;
  tone?: "page" | "surface";
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-20 border-b border-line py-16 sm:py-24 ${tone === "surface" ? "bg-surface" : ""}`}>
      <div className={CONTAINER}>
        <header className="mb-10 grid gap-3 md:grid-cols-12 md:items-end md:gap-8">
          <h2 className="title-display text-3xl sm:text-4xl md:col-span-5">{title}</h2>
          {note && <p className="max-w-xl text-muted md:col-span-6 md:col-start-7">{note}</p>}
        </header>
        {children}
      </div>
    </section>
  );
}

function QuickFact({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  return (
    <div className="py-4 sm:px-6 sm:first:pl-0 sm:last:pr-0">
      <dt className="flex items-center gap-2 text-sm text-subtle">
        <span className="text-gold">{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-fg">
        {href ? (
          <a href={href} target="_blank" rel="noopener" className="hover:text-gold-strong">
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
