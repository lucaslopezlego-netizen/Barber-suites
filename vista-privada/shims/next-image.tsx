/* eslint-disable @next/next/no-img-element */
import { ASSETS } from "../assets";

const MAP: Record<string, string> = {
  "/logo.png": ASSETS.logo,
  "/galeria/trabajo-1.jpg": ASSETS.t1,
  "/galeria/trabajo-2.jpg": ASSETS.t2,
};

type Props = React.ImgHTMLAttributes<HTMLImageElement> & { src: string; fill?: boolean; priority?: boolean; sizes?: string };

export default function Image({ src, fill, priority, sizes, style, alt = "", ...rest }: Props) {
  void priority;
  void sizes;
  return (
    <img
      src={MAP[src] ?? src}
      alt={alt}
      {...rest}
      style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style}
    />
  );
}
