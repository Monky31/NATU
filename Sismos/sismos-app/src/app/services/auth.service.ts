import { Injectable, signal } from '@angular/core';
import { Recuperacion, Resultado, Usuario } from '../models/usuario';

/** Claves que usa la app dentro del localStorage del navegador. */
export const CLAVE_USUARIOS = 'usuarios';
/** Clave de la versión anterior (HTML puro), que guardaba un solo usuario. */
export const CLAVE_USUARIO_LEGADO = 'userData';
export const CLAVE_SESION = 'isLoggedIn';
export const CLAVE_RECUPERACION = 'recuperacionPassword';

/**
 * "Base de datos" de la aplicación: localStorage del navegador.
 *
 * A diferencia de la versión en HTML (que solo guardaba UN usuario y lo
 * sobrescribía en cada registro), aquí se guarda una LISTA de usuarios
 * bajo la clave `usuarios`. Si existe el usuario antiguo de la versión
 * HTML (clave `userData`), se migra automáticamente a la lista.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Lista de usuarios registrados (signal: se actualiza sola en la vista). */
  readonly usuarios = signal<Usuario[]>([]);
  /** true si hay alguien con la sesión iniciada. */
  readonly logueado = signal(false);

  constructor() {
    this.cargarUsuarios();
    this.logueado.set(localStorage.getItem(CLAVE_SESION) === 'true');
  }

  /* ===================== REGISTRO ===================== */

  /**
   * Registra un usuario nuevo.
   * Valida que los campos no estén vacíos, que el correo tenga formato
   * válido y que el usuario o el correo no existan ya.
   */
  registrar(username: string, email: string, password: string): Resultado {
    username = username.trim();
    email = email.trim().toLowerCase();
    password = password.trim();

    if (!username || !email || !password) {
      return { ok: false, error: 'Por favor, completa todos los campos.' };
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValido) {
      return {
        ok: false,
        error: 'Por favor, escribe un correo electrónico válido (ejemplo: nombre@gmail.com).',
      };
    }

    if (password.length < 6) {
      return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    const duplicado = this.usuarios().some(
      (u) =>
        u.username.toLowerCase() === username.toLowerCase() || u.email === email,
    );

    if (duplicado) {
      return {
        ok: false,
        error: 'Ese nombre de usuario o correo ya está registrado. Usa otro.',
      };
    }

    const nuevo: Usuario = {
      username,
      email,
      password,
      fechaRegistro: new Date().toLocaleString('es-CO'),
    };

    this.usuarios.update((lista) => [...lista, nuevo]);
    this.persistir();

    return { ok: true };
  }

  /* ===================== INICIO DE SESIÓN ===================== */

  /** Busca un usuario por nombre de usuario y contraseña. Devuelve null si no coincide. */
  login(username: string, password: string): Usuario | null {
    username = username.trim();

    return (
      this.usuarios().find(
        (u) => u.username === username && u.password === password,
      ) ?? null
    );
  }

  /** Marca la sesión como iniciada (clave `isLoggedIn` en localStorage). */
  marcarSesion(): void {
    localStorage.setItem(CLAVE_SESION, 'true');
    this.logueado.set(true);
  }

  /** Cierra la sesión actual. */
  cerrarSesion(): void {
    localStorage.removeItem(CLAVE_SESION);
    this.logueado.set(false);
  }

  /* ===================== RECUPERAR CONTRASEÑA ===================== */

  buscarPorEmail(email: string): Usuario | null {
    email = email.trim().toLowerCase();
    return this.usuarios().find((u) => u.email === email) ?? null;
  }

  /** Cambia la contraseña del usuario con ese correo. */
  cambiarPassword(email: string, nuevaPassword: string): Resultado {
    const usuario = this.buscarPorEmail(email);
    if (!usuario) {
      return { ok: false, error: 'No se encontró la cuenta registrada.' };
    }

    this.usuarios.update((lista) =>
      lista.map((u) => (u.email === usuario.email ? { ...u, password: nuevaPassword } : u)),
    );
    this.persistir();

    return { ok: true };
  }

  obtenerRecuperacion(): Recuperacion | null {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_RECUPERACION) ?? 'null');
    } catch {
      return null;
    }
  }

  guardarRecuperacion(email: string, codigo: string, minutosExpiracion: number): void {
    const recuperacion: Recuperacion = {
      email,
      codigo,
      intentos: 0,
      expira: Date.now() + minutosExpiracion * 60 * 1000,
    };
    localStorage.setItem(CLAVE_RECUPERACION, JSON.stringify(recuperacion));
  }

  /** Guarda el número de intentos fallidos del código. */
  actualizarRecuperacion(recuperacion: Recuperacion): void {
    localStorage.setItem(CLAVE_RECUPERACION, JSON.stringify(recuperacion));
  }

  limpiarRecuperacion(): void {
    localStorage.removeItem(CLAVE_RECUPERACION);
  }

  /* ===================== ADMINISTRACIÓN DE DATOS ===================== */

  /** Elimina un usuario por nombre de usuario. */
  eliminarUsuario(username: string): void {
    this.usuarios.update((lista) => lista.filter((u) => u.username !== username));
    this.persistir();
  }

  /** Borra TODOS los datos guardados (usuarios, sesión y recuperación). */
  borrarTodo(): void {
    this.usuarios.set([]);
    localStorage.removeItem(CLAVE_USUARIOS);
    localStorage.removeItem(CLAVE_USUARIO_LEGADO);
    localStorage.removeItem(CLAVE_SESION);
    localStorage.removeItem(CLAVE_RECUPERACION);
    this.logueado.set(false);
  }

  /** Lee la lista de usuarios guardada en localStorage (con migración de la versión HTML). */
  private cargarUsuarios(): void {
    let usuarios: Usuario[] = [];

    try {
      usuarios = JSON.parse(localStorage.getItem(CLAVE_USUARIOS) ?? '[]');
    } catch {
      usuarios = [];
    }

    if (!Array.isArray(usuarios)) {
      usuarios = [];
    }

    // Migración: la versión en HTML guardaba UN solo usuario en 'userData'.
    const legado = localStorage.getItem(CLAVE_USUARIO_LEGADO);
    if (legado) {
      try {
        const usuarioLegado = JSON.parse(legado);
        const yaExiste = usuarios.some(
          (u) => u.username === usuarioLegado.username || u.email === usuarioLegado.email,
        );

        if (!yaExiste && usuarioLegado.username && usuarioLegado.email) {
          usuarios.push({
            username: usuarioLegado.username,
            email: usuarioLegado.email,
            password: usuarioLegado.password ?? '',
            fechaRegistro: usuarioLegado.fechaRegistro ?? 'Registrado en la versión HTML',
          });
        }
      } catch {
        // Datos legados dañados: se ignoran.
      }
    }

    this.usuarios.set(usuarios);
    this.persistir();
  }

  /** Guarda la lista actual de usuarios en localStorage. */
  private persistir(): void {
    localStorage.setItem(CLAVE_USUARIOS, JSON.stringify(this.usuarios()));
  }
}
