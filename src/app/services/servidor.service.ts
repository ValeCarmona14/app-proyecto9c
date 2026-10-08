import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject } from 'rxjs';
import { Conexion, OrigenDatos, RegistroPeticion } from './peticion.model';

/**
 * "Origen de datos": un JSON guardado con Capacitor Preferences que contiene
 *   - conexion: protocolo, IP, puerto de la API (Apache) y puerto de la BD (MySQL)
 *   - ultimaPeticion: cabeceras, payload, IP destino y respuesta de la última llamada
 *
 * Todas las pantallas que consumen APIs leen la conexión de aquí, así la IP
 * persiste aunque cierres la app.
 */
@Injectable({ providedIn: 'root' })
export class ServidorService {
  private static readonly CLAVE = 'fh_origen_datos';
  private static readonly CLAVE_VIEJA = 'fh_servidor'; // versión anterior (solo "ip:puerto")

  private cache: OrigenDatos | null = null;

  /** Avisa a las pantallas cuando cambia el JSON. */
  readonly cambios$ = new BehaviorSubject<OrigenDatos | null>(null);

  /** Valores iniciales. En el emulador de Android, 10.0.2.2 es tu PC. */
  conexionPorDefecto(): Conexion {
    return {
      protocolo: 'http',
      ip: Capacitor.isNativePlatform() ? '10.0.2.2' : 'localhost',
      puertoApi: 8080,
      puertoBd: 3307,
    };
  }

  // ==================== LEER ====================

  /** Devuelve el JSON completo. */
  async leer(): Promise<OrigenDatos> {
    if (this.cache) return this.cache;

    let datos: OrigenDatos | null = null;
    const { value } = await Preferences.get({ key: ServidorService.CLAVE });
    if (value) {
      try {
        const p = JSON.parse(value);
        const conexion = this.validar({ ...this.conexionPorDefecto(), ...(p?.conexion ?? {}) });
        if (typeof conexion !== 'string') datos = { conexion, ultimaPeticion: p?.ultimaPeticion ?? null };
      } catch { /* JSON dañado: usamos los valores por defecto */ }
    }

    if (!datos) {
      datos = { conexion: this.conexionPorDefecto(), ultimaPeticion: null };
      // Migramos la IP que se guardaba en la versión anterior
      const vieja = await Preferences.get({ key: ServidorService.CLAVE_VIEJA });
      const partes = vieja.value ? ServidorService.separarIpPuerto(vieja.value) : null;
      if (partes) datos.conexion = { ...datos.conexion, ...partes };
    }

    this.cache = datos;
    this.cambios$.next(datos);
    return datos;
  }

  async conexion(): Promise<Conexion> {
    return (await this.leer()).conexion;
  }

  /** URL base de las APIs, ej. http://10.0.2.2:8080 */
  static urlBase(c: Conexion): string {
    return `${c.protocolo}://${c.ip}:${c.puertoApi}`;
  }

  /** URL completa de una API. Ej: url('tab1_api/login.php') */
  async url(ruta: string): Promise<string> {
    return `${ServidorService.urlBase(await this.conexion())}/${ruta.replace(/^\/+/, '')}`;
  }

  /** El JSON tal como se guarda, bonito para mostrarlo. */
  async comoTexto(): Promise<string> {
    return JSON.stringify(await this.leer(), null, 2);
  }

  // ==================== GUARDAR ====================

  /** Guarda la conexión. Devuelve un mensaje de error o null si todo bien. */
  async guardarConexion(cambios: Partial<Conexion>): Promise<string | null> {
    const actual = await this.leer();
    const nueva = this.validar({ ...actual.conexion, ...cambios });
    if (typeof nueva === 'string') return nueva;
    await this.escribir({ ...actual, conexion: nueva });
    return null;
  }

  /** Guarda el JSON escrito a mano en la pantalla Origen de datos. */
  async guardarJson(texto: string): Promise<string | null> {
    let p: any;
    try {
      p = JSON.parse(texto);
    } catch (e: any) {
      return `El JSON no es válido: ${e?.message ?? e}`;
    }
    if (!p || typeof p !== 'object' || !p.conexion) return 'El JSON debe tener un objeto "conexion".';
    const actual = await this.leer();
    const nueva = this.validar({ ...actual.conexion, ...p.conexion });
    if (typeof nueva === 'string') return nueva;
    await this.escribir({ conexion: nueva, ultimaPeticion: p.ultimaPeticion ?? actual.ultimaPeticion });
    return null;
  }

  /** Guarda el registro de la última petición (lo llama HttpService). */
  async guardarPeticion(registro: RegistroPeticion): Promise<void> {
    const actual = await this.leer();
    await this.escribir({ ...actual, ultimaPeticion: registro });
  }

  /** Vuelve a los valores de fábrica. */
  async restablecer(): Promise<void> {
    await this.escribir({ conexion: this.conexionPorDefecto(), ultimaPeticion: null });
  }

  private async escribir(datos: OrigenDatos) {
    this.cache = datos;
    await Preferences.set({ key: ServidorService.CLAVE, value: JSON.stringify(datos) });
    this.cambios$.next(datos);
  }

  // ==================== CAMPO "SERVIDOR" DEL LOGIN ====================

  /** Texto "ip:puerto" para el campo del login. */
  async obtener(): Promise<string> {
    const c = await this.conexion();
    return `${c.ip}:${c.puertoApi}`;
  }

  /** Guarda lo que se escribió en el login ("10.0.2.2:8080", "http://192.168.1.5"...). */
  async guardar(texto: string): Promise<boolean> {
    const partes = ServidorService.separarIpPuerto(texto);
    if (!partes) return false;
    return (await this.guardarConexion(partes)) === null;
  }

  static separarIpPuerto(texto: string): Partial<Conexion> | null {
    let t = (texto || '').trim();
    let protocolo: 'http' | 'https' | undefined;
    const m = t.match(/^(https?):\/\//i);
    if (m) { protocolo = m[1].toLowerCase() as 'http' | 'https'; t = t.slice(m[0].length); }
    t = t.replace(/\/+$/, '');
    const r = t.match(/^([a-z0-9.-]+)(?::(\d{1,5}))?$/i);
    if (!r) return null;
    const partes: Partial<Conexion> = { ip: r[1], puertoApi: r[2] ? Number(r[2]) : 8080 };
    if (protocolo) partes.protocolo = protocolo;
    return partes;
  }

  // ==================== VALIDACIÓN ====================

  /** Devuelve la conexión limpia, o un texto con el error. */
  private validar(c: any): Conexion | string {
    const protocolo = String(c.protocolo ?? '').toLowerCase();
    if (protocolo !== 'http' && protocolo !== 'https') return 'El protocolo debe ser "http" o "https".';
    const ip = String(c.ip ?? '').trim();
    if (!/^[a-z0-9.-]+$/i.test(ip)) return 'La IP no es válida. Ejemplo: 10.0.2.2 o 192.168.1.50';
    const puertoApi = Number(c.puertoApi);
    const puertoBd = Number(c.puertoBd);
    const puertoOk = (p: number) => Number.isInteger(p) && p > 0 && p <= 65535;
    if (!puertoOk(puertoApi)) return 'El puerto de la API debe ser un número entre 1 y 65535.';
    if (!puertoOk(puertoBd)) return 'El puerto de la base de datos debe ser un número entre 1 y 65535.';
    return { protocolo, ip, puertoApi, puertoBd };
  }
}
