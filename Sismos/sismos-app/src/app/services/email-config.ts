/* ============================================================================
 * CONFIGURACIÓN DEL CORREO (EmailJS) — portado de script/EmailConfig.js
 * ----------------------------------------------------------------------------
 * Para que lleguen correos reales:
 *
 * 1. Crea una cuenta gratis en https://www.emailjs.com/
 * 2. Agrega un servicio de correo (Gmail, Outlook, etc.) en "Email Services".
 * 3. Crea DOS plantillas en "Email Templates":
 *
 *    A) Plantilla de INICIO DE SESIÓN
 *       - To Email: {{to_email}}
 *       - To Name:  {{to_name}}
 *       - Subject:  Nuevo inicio de sesión en NATU
 *       - Body:     Hola {{to_name}},
 *                   Se inició sesión en tu cuenta el {{login_time}}.
 *                   {{message}}
 *                   Si no fuiste tú, cambia tu contraseña.
 *
 *    B) Plantilla de RECUPERACIÓN
 *       - To Email: {{to_email}}
 *       - To Name:  {{to_name}}
 *       - Subject:  Código de recuperación - NATU
 *       - Body:     Hola {{to_name}},
 *                   Tu código de verificación es:
 *                   {{verification_code}}
 *                   Vence en {{expiry_minutes}} minutos.
 *                   Si no solicitaste este cambio, ignora este correo.
 *
 * 4. Copia los valores de tu cuenta y reemplaza los que están abajo.
 *
 * NO uses la "Private Key": esta configuración es pública y solo necesita
 * el Service ID, los Template ID y la Public Key.
 * ========================================================================== */

export const EMAILJS_CONFIG = {
  serviceId: 'TU_SERVICE_ID',
  templateId: 'TU_TEMPLATE_ID',
  recoveryTemplateId: 'TU_RECOVERY_TEMPLATE_ID',
  publicKey: 'TU_PUBLIC_KEY',
};

/** true si la plantilla de inicio de sesión ya fue configurada. */
export function emailConfigurado(): boolean {
  return [EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, EMAILJS_CONFIG.publicKey].every(
    (valor) => valor && !String(valor).startsWith('TU_'),
  );
}

/** true si la plantilla de recuperación ya fue configurada. */
export function recuperacionConfigurada(): boolean {
  return [
    EMAILJS_CONFIG.serviceId,
    EMAILJS_CONFIG.recoveryTemplateId,
    EMAILJS_CONFIG.publicKey,
  ].every((valor) => valor && !String(valor).startsWith('TU_'));
}
