// Enlaces dentro de la vista previa: las rutas internas se traducen a acciones
// (ir a la reserva, abrir el panel, saltar a una sección).
type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean };

export function navigate(href: string) {
  window.dispatchEvent(new CustomEvent("demo:navigate", { detail: href }));
}

export default function Link({ href, prefetch, onClick, children, ...rest }: Props) {
  void prefetch;
  const isInternal = href.startsWith("/");
  const display = href.startsWith("/#") ? href.slice(1) : href;
  return (
    <a
      href={isInternal ? display : href}
      onClick={(e) => {
        onClick?.(e);
        if (!isInternal || href.startsWith("/#")) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
