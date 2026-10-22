# Página privada de Barber Suites

Una sola página HTML que se publica como **artefacto privado de Claude**. Al abrirla pide **correo y clave**; con los correctos muestra la web de clientes y el panel del dueño (Resumen, Agenda, Horarios y Clientes).

- Reutiliza los componentes reales de `src/` (flujo de reserva, calendario, editor de horarios, tarjetas de citas) con las mismas reglas de reserva (`store.ts` las reproduce: horario, bloqueos, anticipación, margen y sin dobles reservas).
- Las reservas y el horario se guardan en el almacenamiento del artefacto (capacidad `db`): colección `bookings` y documento `config/horario`.
- El correo y la clave **no están en el repositorio**: se pasan al generar la página. Es un candado de pantalla; la seguridad real es que el artefacto sea privado.

## Generar la página

```bash
VISTA_EMAIL=correo@ejemplo.com VISTA_CLAVE=tu-clave npm run vista:build
```

Crea `vista-privada/dist/barber-suites-privada.html` (ignorado por git). Publícalo como artefacto con la capacidad `db` declarada, o adjúntalo en un chat de Claude y pide publicarlo tal cual.

## Cambiar el correo o la clave

Vuelve a generar con los nuevos valores y publica el archivo en el mismo artefacto (mismo enlace).
