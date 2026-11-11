import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NatuHeader } from '../../components/natu-header/natu-header';
import { AuthService } from '../../services/auth.service';

/** Una entrada (clave + valor) del localStorage, para mostrarla en crudo. */
export interface EntradaLocalStorage {
  clave: string;
  valor: string;
}

/**
 * Panel para ver los datos guardados en la "base de datos" de la app
 * (el localStorage del navegador): usuarios registrados, contraseñas,
 * sesión iniciada, etc. También explica cómo verlos a mano con las
 * herramientas del desarrollador (F12).
 */
@Component({
  imports: [RouterLink, NatuHeader],
  selector: 'app-datos',
  templateUrl: './datos.html',
  styleUrl: './datos.css',
})
export class DatosGuardados implements OnInit, OnDestroy {
  /** Muestra u oculta las contraseñas en la tabla. */
  protected readonly mostrarPassword = signal(false);
  /** Copia cruda de todo el localStorage. */
  protected readonly entradas = signal<EntradaLocalStorage[]>([]);
  /** Controla el botón de "borrar todo" (pide confirmación). */
  protected readonly confirmandoBorrado = signal(false);

  protected readonly auth = inject(AuthService);

  /** La clase .info-body da el fondo claro y el encabezado fijo. */
  ngOnInit(): void {
    document.body.classList.add('info-body');
    this.refrescar();
  }

  ngOnDestroy(): void {
    document.body.classList.remove('info-body');
  }

  /** Vuelve a leer el localStorage completo (tabla en crudo). */
  protected refrescar(): void {
    const entradas: EntradaLocalStorage[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (clave === null) continue;

      const valor = localStorage.getItem(clave) ?? '';
      entradas.push({ clave, valor: this.formatearValor(valor) });
    }

    this.entradas.set(entradas);
  }

  protected alternarPassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  protected eliminar(username: string): void {
    this.auth.eliminarUsuario(username);
    this.refrescar();
  }

  protected pedirConfirmacion(): void {
    this.confirmandoBorrado.set(true);
  }

  protected cancelarBorrado(): void {
    this.confirmandoBorrado.set(false);
  }

  protected borrarTodo(): void {
    this.auth.borrarTodo();
    this.confirmandoBorrado.set(false);
    this.refrescar();
  }

  /** Intenta mostrar los valores JSON con formato bonito. */
  private formatearValor(valor: string): string {
    try {
      return JSON.stringify(JSON.parse(valor), null, 2);
    } catch {
      return valor;
    }
  }
}
