import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NatuHeader } from '../../components/natu-header/natu-header';
import { AuthService } from '../../services/auth.service';

/** Página de registro (port de Registro.html + script/Registro.js). */
@Component({
  imports: [FormsModule, RouterLink, NatuHeader],
  selector: 'app-registro',
  templateUrl: './registro.html',
})
export class Registro {
  protected username = '';
  protected email = '';
  protected password = '';

  /** Mensaje que se muestra bajo el formulario (con estilo Bulma). */
  protected readonly mensaje = signal('');
  protected readonly tipoMensaje = signal('');

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected registrar(): void {
    this.mensaje.set('');
    this.tipoMensaje.set('');

    const resultado = this.auth.registrar(this.username, this.email, this.password);

    if (!resultado.ok) {
      this.tipoMensaje.set('is-danger');
      this.mensaje.set(resultado.error ?? 'No se pudo completar el registro.');
      return;
    }

    this.tipoMensaje.set('is-success');
    this.mensaje.set('✅ Registro exitoso. Serás llevado al inicio de sesión...');

    setTimeout(() => this.router.navigateByUrl('/iniciar-sesion'), 1200);
  }
}
