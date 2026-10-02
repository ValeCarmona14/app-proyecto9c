import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Guarda la dirección del servidor (XAMPP) donde están las APIs.
 *
 * - Se escribe en el login y se guarda con Capacitor Preferences,
 *   así que se conserva aunque cierres la app.
 * - Todos los servicios que llaman a una API piden la URL aquí,
 *   en lugar de tener "localhost" escrito a mano.
 *
 * Se guarda como "host:puerto", por ejemplo "10.0.2.2:8080".
 * MySQL (puerto 3307) no se configura aquí: la app solo habla con
 * las APIs en PHP, y son ellas las que se conectan a MySQL.
 */
@Injectable({ providedIn: 'root' })
export class ServidorService {
  private static readonly CLAVE = 'fh_servidor';

  /** En el emulador de Android, 10.0.2.2 es tu PC. En el navegador, localhost. */
  readonly porDefecto = Capacitor.isNativePlatform() ? '10.0.2.2:8080' : 'localhost:8080';

  private cache: string | null = null;

  /** Devuelve el servidor guardado (o el de por defecto). */
  async obtener(): Promise<string> {
    if (this.cache) return this.cache;
    const { value } = await Preferences.get({ key: ServidorService.CLAVE });
    this.cache = value || this.porDefecto;
    return this.cache;
  }

  /** Valida y guarda lo que escribió el usuario. Devuelve false si no es válido. */
  async guardar(texto: string): Promise<boolean> {
    const limpio = ServidorService.normalizar(texto);
    if (!limpio) return false;
    await Preferences.set({ key: ServidorService.CLAVE, value: limpio });
    this.cache = limpio;
    return true;
  }

  /** Arma la URL completa de una API. Ej: url('tab1_api/login.php') */
  async url(ruta: string): Promise<string> {
    const servidor = await this.obtener();
    return `http://${servidor}/${ruta.replace(/^\/+/, '')}`;
  }

  /**
   * Acepta "10.0.2.2", "10.0.2.2:8080" o "http://10.0.2.2:8080/"
   * y lo deja como "10.0.2.2:8080". Si no trae puerto, usa 8080.
   */
  static normalizar(texto: string): string | null {
    let t = (texto || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (!t) return null;
    if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(t)) return null;
    if (!t.includes(':')) t += ':8080';
    return t;
  }
}
