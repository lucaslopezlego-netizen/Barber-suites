import Image from "next/image";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { whatsappUrl } from "@/lib/phone";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/ui/brand-icons";

export function SiteFooter({ whatsapp = BUSINESS.phone, instagram = BUSINESS.instagram }: { whatsapp?: string; instagram?: string | null }) {
  return (
    <footer className="border-t border-line bg-panel/40">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="" width={48} height={48} className="size-12" />
            <p className="font-display text-lg font-semibold tracking-[0.16em] uppercase">
              Barber <span className="text-gold">Suites</span>
            </p>
          </div>
          <p className="mt-4 max-w-xs text-sm text-muted">{BUSINESS.slogan}.</p>
        </div>
        <div className="text-sm">
          <p className="eyebrow mb-3">Visítanos</p>
          <p className="text-muted">{BUSINESS.address}</p>
          <a href={BUSINESS.mapsUrl} target="_blank" rel="noopener" className="mt-2 inline-block text-gold hover:underline">
            Cómo llegar
          </a>
        </div>
        <div className="text-sm">
          <p className="eyebrow mb-3">Contacto</p>
          <ul className="space-y-2 text-muted">
            <li>
              <a href={whatsappUrl(whatsapp)} target="_blank" rel="noopener" className="inline-flex items-center gap-2 hover:text-cream">
                <WhatsAppIcon className="size-4" /> {BUSINESS.phoneDisplay}
              </a>
            </li>
            {instagram && (
              <li>
                <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 hover:text-cream">
                  <InstagramIcon className="size-4" /> @{instagram}
                </a>
              </li>
            )}
            <li>
              <a
                href="https://www.facebook.com/search/top?q=Barber%20Suites%20Caracas"
                target="_blank"
                rel="noopener"
                className="inline-flex items-center gap-2 hover:text-cream"
              >
                <FacebookIcon className="size-4" /> {BUSINESS.facebookName}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-subtle sm:px-6">
          <p>© {new Date().getFullYear()} {BUSINESS.name}, Baruta, Caracas</p>
          <Link href="/admin" className="hover:text-muted">
            Acceso del equipo
          </Link>
        </div>
      </div>
    </footer>
  );
}
