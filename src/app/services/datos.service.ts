import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import axios from 'axios';
import { AuthService } from './auth.service';

/** Tipos de dato que guardamos por día. */
export type TipoRegistro = 'habitos' | 'entreno' | 'diario' | 'habitos_lista';

/** Un registro = lo que guardaste de un tipo en una fecha. */
interface Registro {
  fecha: string;          // "AAAA-MM-DD" (o "global" para la lista de hábitos)
  tipo: TipoRegistro;
  contenido: any;
  actualizado: number;    // milisegundos; gana el más reciente
  pendiente: boolean;     // true = aún no se sube al servidor
}

export type EstadoSync = 'al-dia' | 'pendiente' | 'sin-conexion' | 'sincronizando';

export interface Habito { id: string; nombre: string; icono: string; }
export interface Ejercicio { id: string; nombre: string; series: number; reps: number; kg: number; }
export interface Diario { texto: string; animo: string; }

const HABITOS_INICIALES: Habito[] = [
  { id: 'agua', nombre: 'Tomar 2 L de agua', icono: 'water-outline' },
  { id: 'mover', nombre: 'Moverme 30 minutos', icono: 'walk-outline' },
  { id: 'leer', nombre: 'Leer 10 páginas', icono: 'book-outline' },
  { id: 'dormir', nombre: 'Dormir antes de las 11', icono: 'moon-outline' },
];

/**
 * "Primero local, luego la nube":
 * 1. Todo se guarda al instante en el teléfono (localStorage), con o sin internet.
 * 2. Cada cambio queda marcado como "pendiente".
 * 3. En cuanto hay conexión, los pendientes se suben a sync.php y se bajan
 *    los cambios hechos en otros dispositivos. Si el mismo dato cambió en
 *    los dos lados, gana el cambio más reciente.
 */
@Injectable({ providedIn: 'root' })
export class DatosService {
  readonly estado$ = new BehaviorSubject<EstadoSync>(navigator.onLine ? 'al-dia' : 'sin-conexion');
  /** Se emite cada vez que llegan datos del servidor, para refrescar pantallas. */
  readonly cambios$ = new BehaviorSubject<number>(0);

  private sincronizandoAhora = false;

  constructor(private auth: AuthService, private zone: NgZone) {
    window.addEventListener('online', () => this.zone.run(() => this.sincronizar()));
    window.addEventListener('offline', () => this.zone.run(() => this.estado$.next('sin-conexion')));
  }

  // ==================== ALMACÉN LOCAL ====================

  private get clave(): string {
    return `fh_datos_${this.auth.getUsuarioId()}`;
  }

  private leerTodo(): Record<string, Registro> {
    try {
      return JSON.parse(localStorage.getItem(this.clave) || '{}');
    } catch {
      return {};
    }
  }

  private escribirTodo(datos: Record<string, Registro>) {
    localStorage.setItem(this.clave, JSON.stringify(datos));
  }

  private leer<T>(fecha: string, tipo: TipoRegistro, porDefecto: T): T {
    const r = this.leerTodo()[`${fecha}|${tipo}`];
    return r ? (r.contenido as T) : porDefecto;
  }

  private guardar(fecha: string, tipo: TipoRegistro, contenido: any) {
    const datos = this.leerTodo();
    datos[`${fecha}|${tipo}`] = { fecha, tipo, contenido, actualizado: Date.now(), pendiente: true };
    this.escribirTodo(datos);
    this.estado$.next(navigator.onLine ? 'pendiente' : 'sin-conexion');
    this.sincronizarPronto();
  }

  // ==================== API PARA LAS PANTALLAS ====================

  habitos(): Habito[] {
    return this.leer<Habito[]>('global', 'habitos_lista', HABITOS_INICIALES);
  }
  guardarHabitos(lista: Habito[]) {
    this.guardar('global', 'habitos_lista', lista);
  }

  habitosHechos(fecha: string): Record<string, boolean> {
    return this.leer(fecha, 'habitos', {});
  }
  guardarHabitosHechos(fecha: string, hechos: Record<string, boolean>) {
    this.guardar(fecha, 'habitos', hechos);
  }

  entreno(fecha: string): Ejercicio[] {
    return this.leer<Ejercicio[]>(fecha, 'entreno', []);
  }
  guardarEntreno(fecha: string, lista: Ejercicio[]) {
    this.guardar(fecha, 'entreno', lista);
  }

  diario(fecha: string): Diario {
    return this.leer<Diario>(fecha, 'diario', { texto: '', animo: '' });
  }
  guardarDiario(fecha: string, d: Diario) {
    this.guardar(fecha, 'diario', d);
  }

  /** Qué días de un mes tienen algo registrado (para los puntitos del calendario). */
  diasConActividad(anio: number, mes: number): Set<string> {
    const prefijo = `${anio}-${String(mes + 1).padStart(2, '0')}-`;
    const dias = new Set<string>();
    for (const r of Object.values(this.leerTodo())) {
      if (!r.fecha.startsWith(prefijo)) continue;
      const c = r.contenido;
      const tieneAlgo =
        (r.tipo === 'habitos' && Object.values(c || {}).some(Boolean)) ||
        (r.tipo === 'entreno' && c?.length > 0) ||
        (r.tipo === 'diario' && (c?.texto?.trim() || c?.animo));
      if (tieneAlgo) dias.add(r.fecha);
    }
    return dias;
  }

  // ==================== FOTO DE FONDO ====================
  // Se guarda aparte (es pesada) y solo en este dispositivo, una por usuario.

  fondo(): string | null {
    return localStorage.getItem(`fh_fondo_${this.auth.getUsuarioId()}`);
  }

  /** Devuelve false si no cupo (el teléfono tiene poco espacio para la app). */
  guardarFondo(dataUrl: string | null): boolean {
    const k = `fh_fondo_${this.auth.getUsuarioId()}`;
    try {
      if (dataUrl) localStorage.setItem(k, dataUrl);
      else localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }

  pendientes(): number {
    return Object.values(this.leerTodo()).filter(r => r.pendiente).length;
  }

  // ==================== SINCRONIZACIÓN ====================

  private temporizador: any;
  /** Agrupa varios cambios seguidos en un solo envío. */
  private sincronizarPronto() {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.sincronizar(), 1500);
  }

  async sincronizar(): Promise<void> {
    const uid = this.auth.getUsuarioId();
    if (!uid || this.sincronizandoAhora) return;
    if (!navigator.onLine) {
      this.estado$.next('sin-conexion');
      return;
    }

    this.sincronizandoAhora = true;
    this.estado$.next('sincronizando');
    const claveUltima = `fh_ultima_sync_${uid}`;

    try {
      const local = this.leerTodo();
      const aSubir = Object.values(local)
        .filter(r => r.pendiente)
        .map(({ fecha, tipo, contenido, actualizado }) => ({ fecha, tipo, contenido, actualizado }));

      const res = await axios.post(
        await this.auth.apiUrl('sync.php'),
        { usuario_id: uid, desde: Number(localStorage.getItem(claveUltima) || 0), registros: aSubir },
        { timeout: 10000 },
      );
      if (!res.data?.ok) throw new Error(res.data?.error || 'sync falló');

      // Volvemos a leer por si escribiste algo mientras viajaba la petición
      const actual = this.leerTodo();

      // Lo que subimos ya no está pendiente (si no cambió mientras tanto)
      for (const s of aSubir) {
        const r = actual[`${s.fecha}|${s.tipo}`];
        if (r && r.actualizado === s.actualizado) r.pendiente = false;
      }

      // Mezclamos lo que viene del servidor: gana el más reciente
      for (const remoto of res.data.registros as any[]) {
        const k = `${remoto.fecha}|${remoto.tipo}`;
        const act = Number(remoto.actualizado);
        if (!actual[k] || act > actual[k].actualizado) {
          actual[k] = {
            fecha: remoto.fecha,
            tipo: remoto.tipo,
            contenido: typeof remoto.contenido === 'string' ? JSON.parse(remoto.contenido) : remoto.contenido,
            actualizado: act,
            pendiente: false,
          };
        }
      }

      this.escribirTodo(actual);
      // La próxima vez solo pedimos lo que el servidor recibió después de ahora
      localStorage.setItem(claveUltima, String(res.data.ahora));
      this.estado$.next(this.pendientes() > 0 ? 'pendiente' : 'al-dia');
      this.cambios$.next(Date.now());
    } catch {
      // Servidor apagado o sin red: los datos siguen seguros en el teléfono
      this.estado$.next('pendiente');
    } finally {
      this.sincronizandoAhora = false;
    }
  }
}
