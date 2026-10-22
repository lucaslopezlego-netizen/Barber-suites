// El correo y la clave NO se guardan en el repositorio: se pasan al generar la página
// (VISTA_EMAIL y VISTA_CLAVE, ver vista-privada/README.md).
declare const __ACCESS_EMAIL__: string;
declare const __ACCESS_PASSWORD__: string;
export const ACCESS_EMAIL = __ACCESS_EMAIL__;
export const ACCESS_PASSWORD = __ACCESS_PASSWORD__;
