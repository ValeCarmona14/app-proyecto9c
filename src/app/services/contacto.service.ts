import { Injectable } from '@angular/core';
import { HttpService } from './http.service';

export interface Contacto {
  id?: number;
  nombre: string;
  empresa?: string;
  email: string;
  telefono: string;
  mensaje: string;
  created_at?: string;
}

export interface ApiResp {
  ok: boolean;
  error?: string;
  data?: Contacto | Contacto[];
  id?: number;
}

@Injectable({ providedIn: 'root' })
export class ContactoService {
  /** Un solo endpoint que enruta por método HTTP (GET/POST/PUT/PATCH/DELETE). */
  private readonly RUTA = 'login_api/login_api.php';

  /** Usa HttpService: la IP sale de "Origen de datos" y cada petición queda registrada. */
  constructor(private http: HttpService) {}

  /** GET -> lista todos */
  async listar(): Promise<ApiResp> {
    return (await this.http.peticion<ApiResp>('get', this.RUTA)).data;
  }

  /** GET ?id= -> uno solo */
  async obtener(id: number): Promise<ApiResp> {
    return (await this.http.peticion<ApiResp>('get', `${this.RUTA}?id=${id}`)).data;
  }

  /** POST -> crear */
  async crear(c: Contacto): Promise<ApiResp> {
    return (await this.http.peticion<ApiResp>('post', this.RUTA, c)).data;
  }

  /** PUT ?id= -> actualización completa */
  async actualizar(id: number, c: Contacto): Promise<ApiResp> {
    return (await this.http.peticion<ApiResp>('put', `${this.RUTA}?id=${id}`, c)).data;
  }

  /** PATCH ?id= -> actualización parcial */
  async actualizarParcial(id: number, cambios: Partial<Contacto>): Promise<ApiResp> {
    return (await this.http.peticion<ApiResp>('patch', `${this.RUTA}?id=${id}`, cambios)).data;
  }

  /** DELETE ?id= -> eliminar */
  async eliminar(id: number): Promise<ApiResp> {
    return (await this.http.peticion<ApiResp>('delete', `${this.RUTA}?id=${id}`)).data;
  }
}
