import { Injectable } from '@angular/core';
import axios from 'axios';

/** Respuesta genérica de la API */
export interface ApiResp {
  ok: boolean;
  error?: string;
  usuario?: any;
  id?: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  /** URL base de la API en XAMPP (Apache en el puerto 8080). */
  private API = 'http://localhost:8080/tab1_api';

  /** POST -> registra un usuario en la tabla usuarios */
  async registrar(data: any): Promise<ApiResp> {
    const res = await axios.post<ApiResp>(`${this.API}/register.php`, data);
    return res.data;
  }

  /** POST -> inicia sesión */
  async login(email: string, password: string): Promise<ApiResp> {
    const res = await axios.post<ApiResp>(`${this.API}/login.php`, {
      email,
      password,
    });
    return res.data;
  }

  // ===== sesión =====
  guardarSesion(usuario: any): void {
    localStorage.setItem('usuario', JSON.stringify(usuario));
  }
  getUsuario(): any | null {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  }
  estaLogueado(): boolean {
    return !!localStorage.getItem('usuario');
  }
  cerrarSesion(): void {
    localStorage.removeItem('usuario');
  }
}
