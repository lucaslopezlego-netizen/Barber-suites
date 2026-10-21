import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // Fuerza una zona horaria distinta a Caracas para demostrar que la lógica
    // no depende de la zona del servidor.
    env: { TZ: "Asia/Tokyo" },
  },
});
