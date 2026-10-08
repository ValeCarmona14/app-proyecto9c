import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { PeticionError, RegistroPeticion } from './peticion.model';

/** Respuesta genérica de la API */
export interface ApiResp {
  ok: boolean;
  error?: string;
  usuario?: any;
  id?: number;
  /** Detalle de la petición (cabeceras, payload, IP destino) para el log de error. */
  registro?: RegistroPeticion;
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
  /** Carpeta de la API dentro de XAMPP (htdocs). */
  readonly CARPETA_API = 'tab1_api';

  constructor(private http: HttpService) {}

  // ==================== LOGIN / REGISTRO ====================

  /** Registra un usuario (necesita internet). */
  async registrar(data: { nombre: string; email: string; password: string }): Promise<ApiResp> {
    if (!navigator.onLine) {
      return { ok: false, error: 'Para crear una cuenta necesitas conexión a internet.' };
    }
    try {
      const { data: resp, registro } = await this.http.peticion<ApiResp>('post', `${this.CARPETA_API}/register.php`, data);
      return { ...resp, registro };
    } catch (e) {
      const registro = e instanceof PeticionError ? e.registro : undefined;
      return { ok: false, error: registro?.mensaje ?? 'No se pudo conectar con el servidor.', registro };
    }
  }

  /**
   * Inicia sesión. Con internet pregunta al servidor; sin internet
   * (o si el servidor no responde) usa las credenciales guardadas.
   * Siempre regresa el "registro" de la petición para el log de error.
   */
  async login(email: string, password: string): Promise<ApiResp> {
    email = email.trim().toLowerCase();
    let registroFallido: RegistroPeticion | undefined;

    if (navigator.onLine) {
      try {
        const { data, registro } = await this.http.peticion<ApiResp>('post', `${this.CARPETA_API}/login.php`, { email, password });
        if (data.ok) {
          const usuario = data.usuario ?? { email };
          await this.recordarCredenciales(email, password, usuario);
          this.guardarSesion(usuario);
        }
        return { ...data, registro };
      } catch (e) {
        // El servidor no respondió: guardamos el detalle e intentamos modo sin conexión
        registroFallido = e instanceof PeticionError ? e.registro : undefined;
      }
    }
    const res = await this.loginSinConexion(email, password);
    if (!res.ok && registroFallido) {
      return { ...res, error: `${registroFallido.mensaje}`, registro: registroFallido };
    }
    return res;
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
