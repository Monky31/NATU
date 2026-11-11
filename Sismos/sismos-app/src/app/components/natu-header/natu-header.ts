import { Component, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/** Un enlace del encabezado. */
export interface EnlaceHeader {
  ruta: string;
  texto: string;
}

/**
 * Encabezado compartido de todas las páginas (port del Navegacion.js original).
 * Incluye el logo, enlaces, el botón "← Volver" y, si hay sesión iniciada,
 * el botón "Cerrar sesión" (antes agregado automáticamente por data-nav-autologout).
 */
@Component({
  selector: 'app-natu-header',
  imports: [RouterLink],
  templateUrl: './natu-header.html',
  styleUrl: './natu-header.css',
})
export class NatuHeader {
  /** Enlaces que aparecen antes del botón Volver. */
  readonly enlaces = input<EnlaceHeader[]>([]);
  /** Muestra u oculta el botón "← Volver". */
  readonly mostrarVolver = input(true);

  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected volver(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigateByUrl('/');
    }
  }

  protected cerrarSesion(): void {
    this.auth.cerrarSesion();
    this.router.navigateByUrl('/');
  }
}
