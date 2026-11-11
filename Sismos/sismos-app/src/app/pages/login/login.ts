import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NatuHeader } from '../../components/natu-header/natu-header';
import { AuthService } from '../../services/auth.service';
import { EmailService } from '../../services/email.service';
import { Usuario } from '../../models/usuario';

/** Página de inicio de sesión (port de Iniciar-Sesion.html + script/Iniciar-Sesion.js). */
@Component({
  imports: [FormsModule, RouterLink, NatuHeader],
  selector: 'app-login',
  templateUrl: './login.html',
})
export class Login {
  protected username = '';
  protected password = '';

  protected readonly mensaje = signal('');
  protected readonly tipoMensaje = signal('');
  protected readonly enviando = signal(false);

  private readonly auth = inject(AuthService);
  private readonly email = inject(EmailService);
  private readonly router = inject(Router);

  protected async iniciarSesion(): Promise<void> {
    this.mensaje.set('');
    this.tipoMensaje.set('');

    if (this.auth.usuarios().length === 0) {
      this.tipoMensaje.set('is-warning');
      this.mensaje.set('No hay usuarios registrados. Serás llevado al registro...');
      setTimeout(() => this.router.navigateByUrl('/registro'), 1500);
      return;
    }

    const usuario = this.auth.login(this.username, this.password);

    if (!usuario) {
      this.tipoMensaje.set('is-danger');
      this.mensaje.set('Usuario o contraseña incorrectos. Por favor, intenta de nuevo.');
      return;
    }

    this.auth.marcarSesion();

    this.enviando.set(true);

    const resultado = await this.email.enviarNotificacionLogin(usuario);
    let mensaje = 'Inicio de sesión iniciado. ¡Bienvenido de nuevo!';

    if (resultado.ok) {
      mensaje += `\n📧 Enviamos una notificación a ${usuario.email}.`;
    } else if (resultado.reason === 'sin-correo') {
      mensaje += '\n⚠️ Tu cuenta no tiene un correo registrado, así que no se pudo enviar el aviso.';
    } else if (resultado.reason === 'no-configurado') {
      mensaje += '\n⚠️ El envío de correos aún no está configurado (src/app/services/email-config.ts).';
    } else {
      mensaje += '\n⚠️ No se pudo enviar el correo de notificación. Revisa la configuración de EmailJS.';
    }

    this.tipoMensaje.set('is-success');
    this.mensaje.set(mensaje);
    this.enviando.set(false);

    setTimeout(() => this.router.navigateByUrl('/mapa'), 1800);
  }
}
