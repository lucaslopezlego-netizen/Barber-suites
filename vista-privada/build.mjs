// Genera la página privada (un solo HTML) para publicarla como artefacto de Claude.
// Uso: VISTA_EMAIL=correo@ejemplo.com VISTA_CLAVE=1234 npm run vista:build
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const P = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(P, "..");
const req = createRequire(ROOT + "/package.json");
const postcss = req("postcss");
const tailwind = req("@tailwindcss/postcss");

const email = process.env.VISTA_EMAIL;
const clave = process.env.VISTA_CLAVE;
if (!email || !clave) {
  console.error("Falta el acceso. Ejemplo: VISTA_EMAIL=correo@ejemplo.com VISTA_CLAVE=1234 npm run vista:build");
  process.exit(1);
}

// Imágenes incrustadas (logo y galería) desde public/
const dataUri = (file, mime) => `data:${mime};base64,${fs.readFileSync(path.join(ROOT, "public", file)).toString("base64")}`;
fs.writeFileSync(
  P + "/assets.ts",
  "// Generado por build.mjs: no editar.\nexport const ASSETS = " +
    JSON.stringify({
      logo: dataUri("logo.png", "image/png"),
      t1: dataUri("galeria/trabajo-1.jpg", "image/jpeg"),
      t2: dataUri("galeria/trabajo-2.jpg", "image/jpeg"),
    }) +
    " as const;\n",
);

const alias = {
  "next/image": P + "/shims/next-image.tsx",
  "next/link": P + "/shims/next-link.tsx",
  "@/app/admin/actions": P + "/mock-actions.ts",
};
const result = await esbuild.build({
  entryPoints: [P + "/main.tsx"],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  target: "es2020",
  define: {
    "process.env.NODE_ENV": '"production"',
    __ACCESS_EMAIL__: JSON.stringify(email),
    __ACCESS_PASSWORD__: JSON.stringify(clave),
  },
  nodePaths: [ROOT + "/node_modules"],
  plugins: [
    {
      name: "alias",
      setup(b) {
        b.onResolve({ filter: /^(next\/image|next\/link|@\/app\/admin\/actions)$/ }, (a) => ({ path: alias[a.path] }));
        b.onResolve({ filter: /^@\// }, (a) => {
          const base = ROOT + "/src/" + a.path.slice(2);
          for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
            if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return { path: base + ext };
          }
          return undefined;
        });
        b.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "empty" }));
        b.onLoad({ filter: /.*/, namespace: "empty" }, () => ({ contents: "" }));
      },
    },
  ],
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = (
  await postcss([tailwind({ base: ROOT })]).process(fs.readFileSync(P + "/styles.css", "utf8"), { from: ROOT + "/src/app/__vista-privada.css" })
).css;
const html = `<title>Barber Suites</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
fs.mkdirSync(P + "/dist", { recursive: true });
fs.writeFileSync(P + "/dist/barber-suites-privada.html", html);
console.log(`Listo: vista-privada/dist/barber-suites-privada.html (${(html.length / 1024).toFixed(0)} KB)`);
