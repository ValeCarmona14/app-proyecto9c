import { Injectable } from '@angular/core';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { ServidorService } from './servidor.service';
import { PeticionError, RegistroPeticion } from './peticion.model';

type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * Todas las llamadas a las APIs pasan por aquí. Así:
 *  - la URL se arma con la conexión guardada en "Origen de datos"
 *  - cada petición queda registrada (cabeceras, payload, IP destino, respuesta)
 *  - si falla, se lanza un PeticionError con TODO el detalle para mostrarlo
 */
@Injectable({ providedIn: 'root' })
export class HttpService {
  constructor(private origen: ServidorService) {}

  async peticion<T = any>(
    metodo: Metodo,
    ruta: string,
    datos?: any,
    timeout = 8000,
  ): Promise<{ data: T; registro: RegistroPeticion }> {
    const destino = await this.origen.conexion();
    const url = `${ServidorService.urlBase(destino)}/${ruta.replace(/^\/+/, '')}`;
    const cabeceras: Record<string, string> = { Accept: 'application/json' };
    if (datos !== undefined) cabeceras['Content-Type'] = 'application/json';

    const inicio = Date.now();
    const base = {
      fecha: new Date().toISOString(),
      metodo: metodo.toUpperCase(),
      url,
      destino: { ...destino },
      payload: datos === undefined ? null : ocultarSecretos(datos),
    };

    try {
      const res: AxiosResponse<T> = await axios.request<T>({ method: metodo, url, data: datos, headers: cabeceras, timeout });
      const registro: RegistroPeticion = {
        ...base,
        cabecerasEnviadas: aObjeto(res.config?.headers) ?? cabeceras,
        exito: true,
        estadoHttp: res.status,
        mensaje: `HTTP ${res.status} ${res.statusText || ''}`.trim(),
        cabecerasRespuesta: aObjeto(res.headers),
        respuesta: ocultarSecretos(res.data),
        duracionMs: Date.now() - inicio,
      };
      await this.origen.guardarPeticion(registro);
      return { data: res.data, registro };
    } catch (e) {
      const err = e as AxiosError;
      const registro: RegistroPeticion = {
        ...base,
        cabecerasEnviadas: aObjeto(err.config?.headers) ?? cabeceras,
        exito: false,
        estadoHttp: err.response?.status ?? null,
        mensaje: describirError(err, timeout),
        cabecerasRespuesta: err.response ? aObjeto(err.response.headers) : null,
        respuesta: err.response ? ocultarSecretos(err.response.data) : null,
        duracionMs: Date.now() - inicio,
      };
      await this.origen.guardarPeticion(registro);
      throw new PeticionError(registro);
    }
  }
}

/** Convierte las cabeceras de axios en un objeto simple { nombre: valor }. */
function aObjeto(h: any): Record<string, string> | null {
  if (!h) return null;
  const plano = typeof h.toJSON === 'function' ? h.toJSON() : h;
  const r: Record<string, string> = {};
  for (const [k, v] of Object.entries(plano)) {
    if (v !== undefined && v !== null && typeof v !== 'function') r[k] = String(v);
  }
  return r;
}

/** Nunca mostramos contraseñas en el log. */
function ocultarSecretos(valor: any): any {
  if (Array.isArray(valor)) return valor.map(ocultarSecretos);
  if (valor && typeof valor === 'object') {
    const r: any = {};
    for (const [k, v] of Object.entries(valor)) {
      r[k] = /pass|contrase|token|hash/i.test(k) ? '••••••' : ocultarSecretos(v);
    }
    return r;
  }
  return valor;
}

/** Explica en español por qué falló. */
function describirError(err: AxiosError, timeout: number): string {
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return `Tiempo agotado: el servidor no respondió en ${timeout / 1000} s.`;
  }
  if (!err.response) {
    return 'No hubo respuesta del servidor (Network Error). Revisa que XAMPP esté encendido, '
      + 'que la IP y el puerto sean correctos, el firewall de Windows y los encabezados CORS del PHP.';
  }
  const s = err.response.status;
  if (s === 404) return 'HTTP 404: no existe ese archivo PHP en esa ruta. Revisa la carpeta en htdocs.';
  if (s >= 500) return `HTTP ${s}: error dentro del PHP o de MySQL. Revisa la respuesta y el log de Apache.`;
  return `HTTP ${s} ${err.response.statusText || ''}`.trim();
}
