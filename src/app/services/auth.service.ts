import { Injectable } from '@angular/core';
import axios from 'axios';

/** Respuesta genérica de la API */
export interface ApiResp {
  ok: boolean;
  error?: string;
  usuario?: any;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  /**
   * URL base de tu API en XAMPP.
   * Apache está en el puerto 8080 (ajústalo si cambias de puerto/carpeta).
   */
  private API = 'http://localhost:8080/tab1_api';

  // ==================== LLAMADAS A LA API (AXIOS) ====================

  /** Registra un usuario. Devuelve la respuesta de la API. */
  async registrar(data: any): Promise<ApiResp> {
    const res = await axios.post<ApiResp>(`${this.API}/register.php`, data);
    return res.data;
  }

  /** Inicia sesión. Devuelve la respuesta de la API. */
  async login(email: string, password: string): Promise<ApiResp> {
    const res = await axios.post<ApiResp>(`${this.API}/login.php`, {
      email,
      password,
    });
    return res.data;
  }

  // ==================== MANEJO DE SESIÓN ====================

  /** Guarda el usuario logueado en el navegador. */
  guardarSesion(usuario: any): void {
    localStorage.setItem('usuario', JSON.stringify(usuario));
  }

  /** Devuelve el usuario logueado (o null si no hay). */
  getUsuario(): any | null {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  }

  /** true si hay una sesión activa. Lo usa el guard. */
  estaLogueado(): boolean {
    return !!localStorage.getItem('usuario');
  }

  /** Cierra la sesión (borra el usuario guardado). */
  cerrarSesion(): void {
    localStorage.removeItem('usuario');
  }
}
