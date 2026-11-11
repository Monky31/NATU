import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NatuHeader } from '../../components/natu-header/natu-header';
import { AuthService } from '../../services/auth.service';
import { EmailService } from '../../services/email.service';
import { Usuario } from '../../models/usuario';

/** Minutos de vigencia del código de verificación. */
const MINUTOS_EXPIRACION = 10;
/** Intentos máximos para acertar el código. */
const MAX_INTENTOS = 5;
/** Si EmailJS falla, se muestra el código en pantalla para poder probar el flujo. */
const MOSTRAR_CODIGO_SI_FALLA_EL_CORREO = true;

/**
 * Recuperar contraseña (port de Olvida-Contraseña.html + script/Recuperar-Contrasena.js).
 *
 * Flujo:
 * 1. El usuario escribe el correo con el que se registró.
 * 2. Se genera un código de 6 dígitos y se envía por EmailJS.
 * 3. El usuario ingresa el código y define una nueva contraseña.
 * 4. La contraseña se actualiza en localStorage.
 */
@Component({
  imports: [FormsModule, RouterLink, NatuHeader],
  selector: 'app-recuperar',
  templateUrl: './recuperar.html',
})
export class RecuperarContrasena {
  protected email = '';
  protected codigo = '';
  protected password = '';
  protected confirmPassword = '';

  /** Paso del flujo: 1 = pedir código, 2 = código + nueva contraseña. */
  protected readonly paso = signal<1 | 2>(1);
  protected readonly mensaje = signal('');
  protected readonly tipoMensaje = signal('');
  protected readonly enviando = signal(false);
  protected readonly reenviando = signal(false);

  private readonly auth = inject(AuthService);
  private readonly emailService = inject(EmailService);
  private readonly router = inject(Router);

  /* ---------- Paso 1: pedir el código ---------- */

  protected async enviarCodigo(): Promise<void> {
    this.ocultarMensaje();

    const email = this.email.trim().toLowerCase();

    if (this.auth.usuarios().length === 0) {
      this.mostrarMensaje(
        'is-danger',
        'No hay ningún usuario registrado. Primero crea una cuenta.',
      );
      return;
    }

    const usuario = this.auth.buscarPorEmail(email);

    if (!usuario) {
      this.mostrarMensaje(
        'is-danger',
        'Ese correo no coincide con el correo de ninguna cuenta registrada.',
      );
      return;
    }

    this.enviando.set(true);
    this.mostrarMensaje('is-info', 'Enviando código de verificación...');

    await this.solicitarCodigo(email, usuario);

    this.enviando.set(false);
  }

  /* ---------- Paso 2: validar código y cambiar contraseña ---------- */

  protected cambiarPassword(): void {
    this.ocultarMensaje();

    const recuperacion = this.auth.obtenerRecuperacion();

    if (!recuperacion) {
      this.mostrarMensaje('is-danger', 'Primero solicita un código de verificación.');
      this.mostrarPaso1();
      return;
    }

    if (Date.now() > recuperacion.expira) {
      this.auth.limpiarRecuperacion();
      this.mostrarMensaje('is-danger', 'El código expiró. Solicita uno nuevo.');
      this.mostrarPaso1();
      return;
    }

    const codigoIngresado = this.codigo.trim();

    if (!/^\d{6}$/.test(codigoIngresado)) {
      this.mostrarMensaje('is-danger', 'El código debe tener exactamente 6 dígitos.');
      return;
    }

    if (codigoIngresado !== recuperacion.codigo) {
      recuperacion.intentos += 1;

      if (recuperacion.intentos >= MAX_INTENTOS) {
        this.auth.limpiarRecuperacion();
        this.mostrarMensaje(
          'is-danger',
          'Superaste el número de intentos. Solicita un código nuevo.',
        );
        this.mostrarPaso1();
        return;
      }

      this.auth.actualizarRecuperacion(recuperacion);
      this.mostrarMensaje(
        'is-danger',
        `Código incorrecto. Te quedan ${MAX_INTENTOS - recuperacion.intentos} intentos.`,
      );
      return;
    }

    if (this.password.length < 6) {
      this.mostrarMensaje('is-danger', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.mostrarMensaje('is-danger', 'Las contraseñas no coinciden.');
      return;
    }

    const resultado = this.auth.cambiarPassword(recuperacion.email, this.password);

    if (!resultado.ok) {
      this.mostrarMensaje('is-danger', resultado.error ?? 'No se encontró la cuenta registrada.');
      return;
    }

    this.auth.limpiarRecuperacion();

    this.mostrarMensaje(
      'is-success',
      '✅ Contraseña actualizada correctamente. Serás llevado al inicio de sesión.',
    );

    setTimeout(() => this.router.navigateByUrl('/iniciar-sesion'), 1800);
  }

  /* ---------- Botones auxiliares ---------- */

  protected async reenviar(): Promise<void> {
    this.ocultarMensaje();

    const recuperacion = this.auth.obtenerRecuperacion();

    if (!recuperacion) {
      this.mostrarMensaje('is-danger', 'Primero escribe tu correo y solicita un código.');
      this.mostrarPaso1();
      return;
    }

    const usuario = this.auth.buscarPorEmail(recuperacion.email);

    if (!usuario) {
      this.mostrarMensaje('is-danger', 'No se encontró la cuenta registrada.');
      return;
    }

    this.reenviando.set(true);
    await this.solicitarCodigo(recuperacion.email, usuario);
    this.reenviando.set(false);
  }

  protected usarOtroCorreo(): void {
    this.auth.limpiarRecuperacion();
    this.ocultarMensaje();
    this.mostrarPaso1();
  }

  /* ---------- Ayudantes privados ---------- */

  /** Genera el código, lo guarda y trata de enviarlo por correo. */
  private async solicitarCodigo(email: string, usuario: Usuario) {
    const codigo = this.generarCodigo();
    this.auth.guardarRecuperacion(email, codigo, MINUTOS_EXPIRACION);

    const resultado = await this.emailService.enviarCodigoRecuperacion(
      usuario,
      codigo,
      MINUTOS_EXPIRACION,
    );

    if (resultado.ok) {
      this.mostrarMensaje(
        'is-success',
        `Enviamos un código de verificación a ${email}. Revisa también la carpeta de spam.`,
      );
    } else if (resultado.reason === 'no-configurado') {
      this.mostrarMensaje(
        'is-warning',
        `EmailJS aún no está configurado. Código de demostración: ${codigo}`,
      );
    } else if (MOSTRAR_CODIGO_SI_FALLA_EL_CORREO) {
      this.mostrarMensaje(
        'is-warning',
        `No se pudo enviar el correo. Código de demostración: ${codigo}`,
      );
    } else {
      this.mostrarMensaje(
        'is-danger',
        'No se pudo enviar el correo de verificación. Intenta de nuevo más tarde.',
      );
    }

    this.mostrarPaso2(email);
  }

  /** Código aleatorio de 6 dígitos. */
  private generarCodigo(): string {
    if (window.crypto && window.crypto.getRandomValues) {
      const valores = new Uint32Array(1);
      window.crypto.getRandomValues(valores);
      return String(valores[0] % 1000000).padStart(6, '0');
    }

    return String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  }

  private mostrarPaso2(email: string): void {
    this.paso.set(2);
    this.emailSolicitado = email;
  }

  private mostrarPaso1(): void {
    this.paso.set(1);
    this.password = '';
    this.confirmPassword = '';
    this.codigo = '';
  }

  private mostrarMensaje(tipo: string, texto: string): void {
    this.tipoMensaje.set(tipo);
    this.mensaje.set(texto);
  }

  private ocultarMensaje(): void {
    this.mensaje.set('');
  }

  /** Correo al que se envió el código (se muestra en el paso 2). */
  protected emailSolicitado = '';
}
