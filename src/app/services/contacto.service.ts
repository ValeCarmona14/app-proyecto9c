import { Injectable } from '@angular/core';
import axios from 'axios';

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
  private API = 'http://localhost:8080/login_api/login_api.php';

  /** GET -> lista todos */
  async listar(): Promise<ApiResp> {
    const res = await axios.get<ApiResp>(this.API);
    return res.data;
  }

  /** GET ?id= -> uno solo */
  async obtener(id: number): Promise<ApiResp> {
    const res = await axios.get<ApiResp>(`${this.API}?id=${id}`);
    return res.data;
  }

  /** POST -> crear */
  async crear(c: Contacto): Promise<ApiResp> {
    const res = await axios.post<ApiResp>(this.API, c);
    return res.data;
  }

  /** PUT ?id= -> actualización completa */
  async actualizar(id: number, c: Contacto): Promise<ApiResp> {
    const res = await axios.put<ApiResp>(`${this.API}?id=${id}`, c);
    return res.data;
  }

  /** PATCH ?id= -> actualización parcial */
  async actualizarParcial(id: number, cambios: Partial<Contacto>): Promise<ApiResp> {
    const res = await axios.patch<ApiResp>(`${this.API}?id=${id}`, cambios);
    return res.data;
  }

  /** DELETE ?id= -> eliminar */
  async eliminar(id: number): Promise<ApiResp> {
    const res = await axios.delete<ApiResp>(`${this.API}?id=${id}`);
    return res.data;
  }
}
