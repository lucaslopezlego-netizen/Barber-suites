// Mensajes para el cliente según el código de error de la base de datos.
export const BOOKING_ERRORS = {
  SLOT_TAKEN: "Alguien acaba de reservar ese horario. Elige otra hora, por favor.",
  TOO_SOON: "Esa hora ya no está disponible por la anticipación mínima. Elige una más tarde.",
  TOO_FAR: "Esa fecha todavía no está abierta para reservas.",
  OUTSIDE_HOURS: "Esa hora está fuera del horario del barbero.",
  TIME_OFF: "El barbero no estará disponible en ese horario.",
  INVALID_SERVICE: "Ese servicio ya no está disponible.",
  INVALID_BARBER: "Ese barbero ya no está disponible.",
  SERVICE_NOT_OFFERED: "Ese barbero no realiza el servicio elegido.",
  RATE_LIMIT: "Demasiados intentos seguidos. Espera unos minutos o escríbenos por WhatsApp.",
  TOO_MANY_BOOKINGS: "Ya tienes varias citas pendientes. Escríbenos por WhatsApp para gestionarlas.",
  INVALID_INPUT: "Revisa los datos del formulario e inténtalo de nuevo.",
  NOT_CONFIGURED: "Las reservas en línea aún no están activas. Escríbenos por WhatsApp.",
  SERVER_ERROR: "No pudimos completar la reserva. Inténtalo de nuevo o escríbenos por WhatsApp.",
} as const;

export type BookingErrorCode = keyof typeof BOOKING_ERRORS;
