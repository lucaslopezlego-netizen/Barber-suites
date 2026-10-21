// Traduce errores de Supabase/Postgres a mensajes para el dueño.
const MESSAGES: Record<string, string> = {
  SLOT_TAKEN: "Ese barbero ya tiene una cita en ese horario.",
  OVERLAP: "Hay bloques de horario que se cruzan el mismo día. Revísalos.",
  INVALID_RANGE: "La hora de inicio debe ser anterior a la hora de fin.",
  INVALID_INPUT: "Revisa los datos: hay algún campo vacío o con formato incorrecto.",
  INVALID_SERVICE: "Ese servicio no existe.",
  INVALID_BARBER: "Ese barbero no existe.",
  SERVICE_NOT_OFFERED: "Ese barbero no hace ese servicio.",
  TOO_SOON: "La hora no cumple la anticipación mínima.",
  TOO_FAR: "La fecha supera los días máximos permitidos.",
  OUTSIDE_HOURS: "La hora está fuera del horario del barbero.",
  TIME_OFF: "El barbero tiene un bloqueo en ese horario.",
  FORBIDDEN: "No tienes permiso para hacer esto.",
  "23P01": "Esa cita se cruza con otra del mismo barbero.",
  "23503": "No se puede borrar porque tiene citas asociadas. Desactívalo en su lugar.",
  "23514": "Algún valor está fuera de los límites permitidos.",
};

export function friendlyError(error: { message?: string; code?: string; details?: string } | null | undefined): string {
  if (!error) return "Ocurrió un error inesperado.";
  if (error.message && MESSAGES[error.message]) return MESSAGES[error.message];
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  return "No se pudo guardar. Inténtalo de nuevo.";
}
