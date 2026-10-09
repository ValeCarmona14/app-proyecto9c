import { Injectable } from '@angular/core';
import { HttpService } from './http.service';
import { AuthService, ApiResp } from './auth.service';
import { PeticionError } from './peticion.model';
import { ResumenMeta } from './foto-perfil.service';

/** Los campos de la tabla "usuarios" que se pueden editar. */
export interface DatosPerfil {
  email: string;
  fname: string;
  lname: string;
  phone: string;
  address: string;
  twitter: string;
  facebook: string;
  gplus: string;
}

export interface CambiosPerfil extends DatosPerfil {
  password_actual?: string;
  password_nueva?: string;
  /** Nombre del archivo en el teléfono, o null para quitar la foto. Si no viene, no se toca. */
  foto?: string | null;
  foto_meta?: ResumenMeta | null;
}

/**
 * Habla con tab1_api/perfil.php. Igual que login/registro, la URL se arma
 * con la IP y el puerto guardados en "Origen de datos" (HttpService).
 */
@Injectable({ providedIn: 'root' })
export class PerfilService {
  private readonly API = 'perfil.php';

  constructor(private http: HttpService, private auth: AuthService) {}

  private get ruta() { return `${this.auth.CARPETA_API}/${this.API}`; }

  /** El id numérico de la base de datos (lo regresa login.php). */
  private idBd(): number | null {
    const id = Number(this.auth.getUsuario()?.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  /** Trae los datos frescos del servidor. */
  async obtener(): Promise<ApiResp> {
    const id = this.idBd();
    if (!id) return { ok: false, error: 'Tu sesión no tiene id. Cierra sesión y vuelve a entrar con internet.' };
    return this.enviar({ accion: 'obtener', id });
  }

  /** Guarda los cambios. Si salen bien, actualiza la sesión guardada en el teléfono. */
  async actualizar(cambios: CambiosPerfil): Promise<ApiResp> {
    const id = this.idBd();
    if (!id) return { ok: false, error: 'Tu sesión no tiene id. Cierra sesión y vuelve a entrar con internet.' };
    if (!navigator.onLine) return { ok: false, error: 'Para guardar tu perfil necesitas conexión a internet.' };

    const resp = await this.enviar({ accion: 'actualizar', id, ...cambios });
    if (resp.ok && resp.usuario) {
      await this.auth.actualizarCuentaLocal(resp.usuario, cambios.password_nueva || undefined);
    }
    return resp;
  }

  private async enviar(payload: any): Promise<ApiResp> {
    try {
      const { data, registro } = await this.http.peticion<ApiResp>('post', this.ruta, payload);
      return { ...data, registro };
    } catch (e) {
      const registro = e instanceof PeticionError ? e.registro : undefined;
      return { ok: false, error: registro?.mensaje ?? 'No se pudo conectar con el servidor.', registro };
    }
  }
}
