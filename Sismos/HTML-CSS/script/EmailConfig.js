/* ============================================================================
 * CONFIGURACIÓN DEL CORREO (EmailJS)
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

const EMAILJS_CONFIG = {
    serviceId: 'TU_SERVICE_ID',
    templateId: 'TU_TEMPLATE_ID',
    recoveryTemplateId: 'TU_RECOVERY_TEMPLATE_ID',
    publicKey: 'TU_PUBLIC_KEY',
};

function emailConfigurado() {
    return [EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, EMAILJS_CONFIG.publicKey].every(
        (valor) => valor && !String(valor).startsWith('TU_')
    );
}

function recuperacionConfigurada() {
    return [
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.recoveryTemplateId,
        EMAILJS_CONFIG.publicKey,
    ].every((valor) => valor && !String(valor).startsWith('TU_'));
}

function inicializarEmailJS() {
    emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
}

/**
 * Envía la notificación de inicio de sesión al correo registrado.
 * @param {{username: string, email: string}} userData
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function enviarNotificacionLogin(userData) {
    if (!emailConfigurado()) {
        console.warn(
            '⚠️ EmailJS no está configurado. Edita script/EmailConfig.js para activar los correos.'
        );
        return { ok: false, reason: 'no-configurado' };
    }

    if (!userData.email) {
        console.warn('⚠️ El usuario no tiene un correo registrado.');
        return { ok: false, reason: 'sin-correo' };
    }

    const fecha = new Date().toLocaleString('es-CO', {
        dateStyle: 'full',
        timeStyle: 'short',
    });

    try {
        inicializarEmailJS();

        await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
            to_email: userData.email,
            to_name: userData.username,
            login_time: fecha,
            message: `Hola ${userData.username}, se inició sesión correctamente en tu cuenta de NATU (Simulador de Sismos).`,
        });

        return { ok: true };
    } catch (error) {
        console.error('❌ No se pudo enviar el correo de inicio de sesión:', error);
        return {
            ok: false,
            reason: error?.text || error?.message || 'error-desconocido',
        };
    }
}

/**
 * Envía el código de verificación para recuperar la contraseña.
 * @param {{username: string, email: string}} userData
 * @param {string} codigo Código de 6 dígitos
 * @param {number} minutos Minutos de vigencia
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
async function enviarCodigoRecuperacion(userData, codigo, minutos) {
    if (!recuperacionConfigurada()) {
        console.warn(
            '⚠️ La plantilla de recuperación no está configurada en script/EmailConfig.js.'
        );
        return { ok: false, reason: 'no-configurado' };
    }

    try {
        inicializarEmailJS();

        await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.recoveryTemplateId, {
            to_email: userData.email,
            to_name: userData.username,
            verification_code: codigo,
            expiry_minutes: minutos,
            message: `Tu código de verificación es ${codigo}. Vence en ${minutos} minutos.`,
        });

        return { ok: true };
    } catch (error) {
        console.error('❌ No se pudo enviar el código de recuperación:', error);
        return {
            ok: false,
            reason: error?.text || error?.message || 'error-desconocido',
        };
    }
}
