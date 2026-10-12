import { Injectable, inject } from '@angular/core';
import {
  HttpClient,
  HttpContext,
  HttpErrorResponse,
  HttpParams,
} from '@angular/common/http';
import { Observable, throwError, timer } from 'rxjs';
import { catchError, map, retry } from 'rxjs/operators';
import { MENSAJE_LOADING } from './loading.interceptor';
import {
  ApiResp,
  ContenidoPorTipo,
  ErrorApi,
  Habito,
  HabitoNuevo,
  LoginResp,
  RegistroCuenta,
  RegistroDia,
  SyncPeticion,
  SyncResp,
  TipoRegistro,
  Usuario,
} from '../models/api.models';

/**
 * Único punto de contacto entre la app y la API REST de FitHábitos.
 *
 * - Las pantallas NUNCA llaman a HttpClient directamente: usan este servicio.
 * - Cada método corresponde a un endpoint del documento de arquitectura.
 * - Todas las respuestas llegan en el sobre { ok, data, error }; aquí se
 *   "desenvuelven" para que las pantallas reciban directamente `data`.
 * - Los errores se traducen a mensajes claros para el usuario (ErrorApi).
 * - El token se agrega solo, en auth.interceptor.ts.
 * - La URL completa (IP de "Origen de datos"), las cabeceras, el tiempo de
 *   espera y el registro de cada petición los pone api.interceptor.ts.
 * - El loading lo pone loading.interceptor.ts. Cada método acepta un texto
 *   para el loading; si se manda null, no se muestra.
 *
 * Implementado en esta entrega (API PHP en htdocs/fithabitos_api/v1):
 *   /habitos  → GET, GET {id}, POST, PUT, PATCH, DELETE
 * El resto de endpoints sigue el documento de arquitectura y se conectará
 * en las siguientes unidades.
 */
@Injectable({ providedIn: 'root' })
export class FitHabitosApiService {
  private readonly http = inject(HttpClient);
  /**
   * Prefijo que reconoce api.interceptor.ts. "api/habitos" se convierte en
   * http://<IP de Origen de datos>:8080/fithabitos_api/v1/index.php/habitos
   */
  private readonly base = 'api';

  /** Opciones de la petición con el texto del loading. */
  private ctx(mensaje: string | null) {
    return { context: new HttpContext().set(MENSAJE_LOADING, mensaje) };
  }

  // ======================= AUTENTICACIÓN =======================

  /** POST /auth/registro */
  registrar(datos: RegistroCuenta): Observable<Usuario> {
    return this.enviar(this.http.post<ApiResp<Usuario>>(`${this.base}/auth/registro`, datos));
  }

  /** POST /auth/login */
  login(email: string, password: string): Observable<LoginResp> {
    return this.enviar(
      this.http.post<ApiResp<LoginResp>>(`${this.base}/auth/login`, { email, password }),
    );
  }

  /** POST /auth/logout */
  logout(): Observable<void> {
    return this.enviar(this.http.post<ApiResp<void>>(`${this.base}/auth/logout`, {}));
  }

  // ========================== USUARIO ==========================

  /** GET /usuarios/me */
  perfil(): Observable<Usuario> {
    return this.consultar(this.http.get<ApiResp<Usuario>>(`${this.base}/usuarios/me`));
  }

  /** PUT /usuarios/me */
  actualizarPerfil(usuario: Omit<Usuario, 'id' | 'email' | 'creadoEn'>): Observable<Usuario> {
    return this.enviar(this.http.put<ApiResp<Usuario>>(`${this.base}/usuarios/me`, usuario));
  }

  // ========================== HÁBITOS ==========================

  /** GET /habitos — lista los hábitos del usuario */
  listarHabitos(loading: string | null = 'Cargando hábitos…'): Observable<Habito[]> {
    return this.consultar(this.http.get<ApiResp<Habito[]>>(`${this.base}/habitos`, this.ctx(loading)));
  }

  /** GET /habitos/{id} — un solo hábito */
  obtenerHabito(id: number, loading: string | null = 'Cargando hábito…'): Observable<Habito> {
    return this.consultar(this.http.get<ApiResp<Habito>>(`${this.base}/habitos/${id}`, this.ctx(loading)));
  }

  /** POST /habitos — crea un hábito (responde 201 con el hábito y su id) */
  crearHabito(habito: HabitoNuevo, loading: string | null = 'Guardando hábito…'): Observable<Habito> {
    return this.enviar(this.http.post<ApiResp<Habito>>(`${this.base}/habitos`, habito, this.ctx(loading)));
  }

  /** PUT /habitos/{id} — reemplaza el hábito completo */
  editarHabito(id: number, habito: HabitoNuevo, loading: string | null = 'Actualizando hábito…'): Observable<Habito> {
    return this.enviar(this.http.put<ApiResp<Habito>>(`${this.base}/habitos/${id}`, habito, this.ctx(loading)));
  }

  /** PATCH /habitos/{id} — cambia solo los campos enviados (ej. { activo: false }) */
  actualizarHabitoParcial(
    id: number,
    cambios: Partial<HabitoNuevo>,
    loading: string | null = 'Actualizando…',
  ): Observable<Habito> {
    return this.enviar(this.http.patch<ApiResp<Habito>>(`${this.base}/habitos/${id}`, cambios, this.ctx(loading)));
  }

  /** DELETE /habitos/{id} */
  eliminarHabito(id: number, loading: string | null = 'Eliminando hábito…'): Observable<void> {
    return this.enviar(this.http.delete<ApiResp<void>>(`${this.base}/habitos/${id}`, this.ctx(loading)));
  }

  // ===================== REGISTROS DEL DÍA =====================

  /** GET /registros?fecha=AAAA-MM-DD */
  registrosDelDia(fecha: string): Observable<RegistroDia[]> {
    const params = new HttpParams().set('fecha', fecha);
    return this.consultar(
      this.http.get<ApiResp<RegistroDia[]>>(`${this.base}/registros`, { params }),
    );
  }

  /** GET /registros/calendario?mes=AAAA-MM  → ["2026-10-01", "2026-10-03", ...] */
  diasConRegistro(mes: string): Observable<string[]> {
    const params = new HttpParams().set('mes', mes);
    return this.consultar(
      this.http.get<ApiResp<string[]>>(`${this.base}/registros/calendario`, { params }),
    );
  }

  /** PUT /registros/{fecha}/{tipo} — guarda o reemplaza (idempotente) */
  guardarRegistro<K extends TipoRegistro>(
    fecha: string,
    tipo: K,
    contenido: ContenidoPorTipo[K],
  ): Observable<RegistroDia<K>> {
    return this.enviar(
      this.http.put<ApiResp<RegistroDia<K>>>(`${this.base}/registros/${fecha}/${tipo}`, {
        contenido,
        actualizado: Date.now(),
      }),
    );
  }

  /** PATCH /registros/{fecha}/habitos — marca o desmarca un solo hábito */
  marcarHabito(fecha: string, habitoId: number, hecho: boolean): Observable<RegistroDia<'habitos'>> {
    return this.enviar(
      this.http.patch<ApiResp<RegistroDia<'habitos'>>>(
        `${this.base}/registros/${fecha}/habitos`,
        { habitoId, hecho },
      ),
    );
  }

  /** DELETE /registros/{fecha}/{tipo} */
  borrarRegistro(fecha: string, tipo: TipoRegistro): Observable<void> {
    return this.enviar(this.http.delete<ApiResp<void>>(`${this.base}/registros/${fecha}/${tipo}`));
  }

  // ====================== SINCRONIZACIÓN =======================

  /** POST /sync — sube pendientes offline y baja cambios de otros dispositivos */
  sincronizar(peticion: SyncPeticion): Observable<SyncResp> {
    return this.enviar(this.http.post<ApiResp<SyncResp>>(`${this.base}/sync`, peticion));
  }

  // ========================= AYUDANTES =========================

  /**
   * Para lecturas (GET): reintenta hasta 2 veces si no hubo conexión o el
   * servidor falló (0 o 5xx), esperando 1 s y luego 2 s.
   */
  private consultar<T>(peticion: Observable<ApiResp<T>>): Observable<T> {
    return peticion.pipe(
      retry({
        count: 2,
        delay: (err, intento) =>
          this.esReintentable(err) ? timer(intento * 1000) : throwError(() => err),
      }),
      map((resp) => this.desenvolver(resp)),
      catchError((err) => this.traducirError(err)),
    );
  }

  /** Para escrituras: sin reintento automático (DatosService decide si queda pendiente). */
  private enviar<T>(peticion: Observable<ApiResp<T>>): Observable<T> {
    return peticion.pipe(
      map((resp) => this.desenvolver(resp)),
      catchError((err) => this.traducirError(err)),
    );
  }

  /** Abre el sobre { ok, data, error }. */
  private desenvolver<T>(resp: ApiResp<T>): T {
    if (!resp.ok) {
      throw { status: 200, mensaje: resp.error ?? 'Ocurrió un error inesperado' } as ErrorApi;
    }
    return resp.data as T;
  }

  private esReintentable(err: unknown): boolean {
    return (
      (err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500)) ||
      (err as Error)?.name === 'TimeoutError'
    );
  }

  /** Convierte cualquier error en un mensaje entendible para el usuario. */
  private traducirError(err: unknown): Observable<never> {
    if ((err as ErrorApi)?.mensaje) {
      return throwError(() => err as ErrorApi);
    }
    if ((err as Error)?.name === 'TimeoutError') {
      return throwError(() => ({ status: 0, mensaje: 'El servidor tardó demasiado en responder' }) as ErrorApi);
    }

    const http = err as HttpErrorResponse;
    const delServidor: string | undefined = http.error?.error;
    const mensajes: Record<number, string> = {
      0: 'Sin conexión: tus cambios se guardan en el teléfono',
      400: 'Revisa los datos del formulario',
      401: 'Tu sesión expiró, vuelve a entrar',
      404: 'No se encontró la información',
      405: 'La API no acepta ese método',
      409: 'Ese correo ya tiene cuenta',
      500: 'El servidor tuvo un problema, intenta más tarde',
    };

    const error: ErrorApi = {
      status: http.status ?? 0,
      mensaje: delServidor ?? mensajes[http.status] ?? 'Ocurrió un error inesperado',
    };
    return throwError(() => error);
  }
}
