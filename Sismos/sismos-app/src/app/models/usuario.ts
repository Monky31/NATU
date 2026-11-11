/**
 * Un usuario registrado en la "base de datos" (localStorage del navegador).
 *
 * OJO (proyecto educativo): la contraseña se guarda tal cual se escribe,
 * en texto plano, igual que en la versión original en HTML. En una
 * aplicación real NUNCA se debe guardar una contraseña sin cifrar.
 */
export interface Usuario {
  username: string;
  email: string;
  password: string;
  /** Fecha en la que el usuario se registró. */
  fechaRegistro: string;
}

/** Resultado de una operación que puede fallar con un mensaje para el usuario. */
export interface Resultado {
  ok: boolean;
  error?: string;
}

/** Estado guardado del flujo "olvidé mi contraseña". */
export interface Recuperacion {
  email: string;
  codigo: string;
  intentos: number;
  expira: number;
}
