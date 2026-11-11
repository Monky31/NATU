import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';
import { EMAILJS_CONFIG, emailConfigurado, recuperacionConfigurada } from './email-config';
import { Usuario } from '../models/usuario';

/** Resultado de intentar enviar un correo. */
export interface ResultadoEmail {
  ok: boolean;
  reason?: string;
}

/**
 * Envío de correos con EmailJS (portado de script/EmailConfig.js).
 * La configuración está en email-config.ts.
 */
@Injectable({ providedIn: 'root' })
export class EmailService {
  private inicializado = false;

  private inicializar(): void {
    if (this.inicializado) return;
    emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
    this.inicializado = true;
  }

  /**
   * Envía la notificación de inicio de sesión al correo registrado.
   */
  async enviarNotificacionLogin(usuario: Usuario): Promise<ResultadoEmail> {
    if (!emailConfigurado()) {
      console.warn(
        '⚠️ EmailJS no está configurado. Edita src/app/services/email-config.ts para activar los correos.',
      );
      return { ok: false, reason: 'no-configurado' };
    }

    if (!usuario.email) {
      console.warn('⚠️ El usuario no tiene un correo registrado.');
      return { ok: false, reason: 'sin-correo' };
    }

    const fecha = new Date().toLocaleString('es-CO', {
      dateStyle: 'full',
      timeStyle: 'short',
    });

    try {
      this.inicializar();

      await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
        to_email: usuario.email,
        to_name: usuario.username,
        login_time: fecha,
        message: `Hola ${usuario.username}, se inició sesión correctamente en tu cuenta de NATU (Simulador de Sismos).`,
      });

      return { ok: true };
    } catch (error) {
      console.error('❌ No se pudo enviar el correo de inicio de sesión:', error);
      return {
        ok: false,
        reason:
          (error as { text?: string; message?: string })?.text ??
          (error as { message?: string })?.message ??
          'error-desconocido',
      };
    }
  }

  /**
   * Envía el código de verificación para recuperar la contraseña.
   * @param codigo Código de 6 dígitos
   * @param minutos Minutos de vigencia
   */
  async enviarCodigoRecuperacion(
    usuario: Usuario,
    codigo: string,
    minutos: number,
  ): Promise<ResultadoEmail> {
    if (!recuperacionConfigurada()) {
      console.warn(
        '⚠️ La plantilla de recuperación no está configurada en src/app/services/email-config.ts.',
      );
      return { ok: false, reason: 'no-configurado' };
    }

    try {
      this.inicializar();

      await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.recoveryTemplateId, {
        to_email: usuario.email,
        to_name: usuario.username,
        verification_code: codigo,
        expiry_minutes: minutos,
        message: `Tu código de verificación es ${codigo}. Vence en ${minutos} minutos.`,
      });

      return { ok: true };
    } catch (error) {
      console.error('❌ No se pudo enviar el código de recuperación:', error);
      return {
        ok: false,
        reason:
          (error as { text?: string; message?: string })?.text ??
          (error as { message?: string })?.message ??
          'error-desconocido',
      };
    }
  }
}
