import { Injectable } from '@angular/core';
import axios from 'axios';
import { ServidorService } from './servidor.service';

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

  constructor(private servidor: ServidorService) {}

  /** URL de la API usando la IP guardada en el login. */
  private api(): Promise<string> {
    return this.servidor.url(this.RUTA);
  }

  /** GET -> lista todos */
  async listar(): Promise<ApiResp> {
    const res = await axios.get<ApiResp>(await this.api());
    return res.data;
  }

  /** GET ?id= -> uno solo */
  async obtener(id: number): Promise<ApiResp> {
    const res = await axios.get<ApiResp>(`${await this.api()}?id=${id}`);
    return res.data;
  }

  /** POST -> crear */
  async crear(c: Contacto): Promise<ApiResp> {
    const res = await axios.post<ApiResp>(await this.api(), c);
    return res.data;
  }

  /** PUT ?id= -> actualización completa */
  async actualizar(id: number, c: Contacto): Promise<ApiResp> {
    const res = await axios.put<ApiResp>(`${await this.api()}?id=${id}`, c);
    return res.data;
  }

  /** PATCH ?id= -> actualización parcial */
  async actualizarParcial(id: number, cambios: Partial<Contacto>): Promise<ApiResp> {
    const res = await axios.patch<ApiResp>(`${await this.api()}?id=${id}`, cambios);
    return res.data;
  }

  /** DELETE ?id= -> eliminar */
  async eliminar(id: number): Promise<ApiResp> {
    const res = await axios.delete<ApiResp>(`${await this.api()}?id=${id}`);
    return res.data;
  }
}
