import { Injectable } from '@angular/core';
import axios from 'axios';
import { ServidorService } from './servidor.service';

/** Respuesta genérica de la API */
export interface ApiResp {
  ok: boolean;
  error?: string;
  usuario?: any;
  id?: number;
}

/**
 * Maneja el login, el registro y la sesión.
 *
 * - La sesión se guarda en localStorage, así que aunque cierres la app
 *   sigues dentro hasta que toques "Cerrar sesión".
 * - Si ya iniciaste sesión alguna vez en este dispositivo, puedes volver
 *   a entrar SIN internet: guardamos un hash (SHA-256) de tu contraseña,
 *   nunca la contraseña en texto.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  /** Carpeta de la API dentro de XAMPP (htdocs). La IP sale de ServidorService. */
  private readonly CARPETA_API = 'tab1_api';

  constructor(private servidor: ServidorService) {}

  /** URL completa de un archivo de la API, usando la IP guardada en el login. */
  async apiUrl(archivo: string): Promise<string> {
    return this.servidor.url(`${this.CARPETA_API}/${archivo}`);
  }

  // ==================== LOGIN / REGISTRO ====================

  /** Registra un usuario (necesita internet). */
  async registrar(data: { nombre: string; email: string; password: string }): Promise<ApiResp> {
    if (!navigator.onLine) {
      return { ok: false, error: 'Para crear una cuenta necesitas conexión a internet.' };
    }
    try {
      const res = await axios.post<ApiResp>(await this.apiUrl('register.php'), data, { timeout: 8000 });
      return res.data;
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor. Revisa que XAMPP esté encendido.' };
    }
  }

  /**
   * Inicia sesión. Con internet pregunta al servidor; sin internet
   * (o si el servidor no responde) usa las credenciales guardadas.
   */
  async login(email: string, password: string): Promise<ApiResp> {
    email = email.trim().toLowerCase();

    if (navigator.onLine) {
      try {
        const res = await axios.post<ApiResp>(await this.apiUrl('login.php'), { email, password }, { timeout: 8000 });
        if (res.data.ok) {
          const usuario = res.data.usuario ?? { email };
          await this.recordarCredenciales(email, password, usuario);
          this.guardarSesion(usuario);
        }
        return res.data;
      } catch {
        // El servidor no respondió: intentamos modo sin conexión
      }
    }
    return this.loginSinConexion(email, password);
  }

  private async loginSinConexion(email: string, password: string): Promise<ApiResp> {
    const raw = localStorage.getItem(`fh_cred_${email}`);
    if (!raw) {
      return {
        ok: false,
        error: 'Sin conexión. Para entrar sin internet primero inicia sesión una vez con internet en este dispositivo.',
      };
    }
    const guardado = JSON.parse(raw);
    if (guardado.hash !== (await this.sha256(password))) {
      return { ok: false, error: 'Correo o contraseña incorrectos.' };
    }
    this.guardarSesion(guardado.usuario);
    return { ok: true, usuario: guardado.usuario };
  }

  private async recordarCredenciales(email: string, password: string, usuario: any) {
    const hash = await this.sha256(password);
    localStorage.setItem(`fh_cred_${email}`, JSON.stringify({ hash, usuario }));
  }

  private async sha256(texto: string): Promise<string> {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ==================== SESIÓN ====================

  guardarSesion(usuario: any): void {
    localStorage.setItem('usuario', JSON.stringify(usuario));
  }

  getUsuario(): any | null {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  }

  /** Id estable del usuario (el de la BD; si no viene, su correo). */
  getUsuarioId(): string | null {
    const u = this.getUsuario();
    if (!u) return null;
    return String(u.id ?? u.email);
  }

  /** Nombre para saludar. */
  getNombre(): string {
    const u = this.getUsuario();
    return u?.nombre || u?.fname || (u?.email ? String(u.email).split('@')[0] : '');
  }

  /** true si hay una sesión activa. Lo usa el guard. */
  estaLogueado(): boolean {
    return !!localStorage.getItem('usuario');
  }

  /** Cierra la sesión. Tus datos locales se conservan para cuando vuelvas. */
  cerrarSesion(): void {
    localStorage.removeItem('usuario');
  }
}
