import type { NextConfig } from "next";

// La integración de Supabase en Vercel puede crear las variables con distintos
// nombres según la versión. Se aceptan todos y se publican con los que usa la web.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  "";
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
  images: {
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }] : [],
  },
  experimental: {
    // Fotos de barberos subidas desde el panel
    serverActions: { bodySizeLimit: "6mb" },
  },
  // El instalador de la base de datos lee este archivo en el servidor
  outputFileTracingIncludes: {
    "/admin/configurar": ["./supabase/instalar-todo.sql"],
  },
};

export default nextConfig;
