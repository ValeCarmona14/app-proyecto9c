import {
  HttpErrorResponse,
  HttpHeaders,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap, tap, catchError, throwError, timeout } from 'rxjs';
import { ServidorService } from './servidor.service';
import { AuthService } from './auth.service';
import { LoadingService } from './loading.service';
import { RegistroPeticion } from './peticion.model';

/** Carpeta de la API REST dentro de htdocs (XAMPP). */
export const CARPETA_API_REST = 'fithabitos_api/v1/index.php';

/** Tiempo máximo de espera por petición. */
const ESPERA_MS = 10_000;

/**
 * Interceptor de la API REST.
 *
 * Las pantallas y servicios piden rutas cortas como  "api/habitos/5".
 * Este interceptor:
 *  1. Arma la URL completa con la IP guardada en "Origen de datos"
 *     → http://10.0.2.2:8080/fithabitos_api/v1/index.php/habitos/5
 *  2. Agrega las cabeceras Accept, Content-Type y X-Usuario-Id (quién soy).
 *  3. Corta la petición si tarda más de 10 s.
 *  4. Guarda el registro de la petición (método, URL, cabeceras, payload,
 *     estado HTTP y respuesta) para verlo en la modal de error y en Origen de datos.
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('api/')) return next(req);

  const origen = inject(ServidorService);
  const auth = inject(AuthService);
  const loading = inject(LoadingService);

  return from(origen.conexion()).pipe(
    switchMap(conexion => {
      const url = `${ServidorService.urlBase(conexion)}/${CARPETA_API_REST}/${req.url.slice(4)}`;

      const cabeceras: Record<string, string> = { Accept: 'application/json' };
      if (req.body !== null && req.body !== undefined) cabeceras['Content-Type'] = 'application/json';
      const usuarioId = auth.getUsuarioId();
      if (usuarioId) cabeceras['X-Usuario-Id'] = usuarioId;

      const params = loading.redLenta ? req.params.set('demora', '2') : req.params;
      const peticion = req.clone({ url, params, setHeaders: cabeceras });

      const inicio = Date.now();
      const base = {
        fecha: new Date().toISOString(),
        metodo: req.method,
        url: peticion.urlWithParams,
        destino: { ...conexion },
        cabecerasEnviadas: aObjeto(peticion.headers),
        payload: req.body ?? null,
      };

      return next(peticion).pipe(
        timeout(ESPERA_MS),
        tap(evento => {
          if (evento instanceof HttpResponse) {
            const registro: RegistroPeticion = {
              ...base,
              exito: true,
              estadoHttp: evento.status,
              mensaje: `HTTP ${evento.status} ${evento.statusText || 'OK'}`,
              cabecerasRespuesta: aObjeto(evento.headers),
              respuesta: evento.body,
              duracionMs: Date.now() - inicio,
            };
            origen.guardarPeticion(registro);
          }
        }),
        catchError((err: unknown) => {
          const http = err instanceof HttpErrorResponse ? err : null;
          const registro: RegistroPeticion = {
            ...base,
            exito: false,
            estadoHttp: http?.status || null,
            mensaje: describirError(err),
            // status 0 = el servidor nunca contestó, así que no hay cabeceras ni cuerpo
            cabecerasRespuesta: http?.status ? aObjeto(http.headers) : null,
            respuesta: http?.status ? (http.error ?? null) : null,
            duracionMs: Date.now() - inicio,
          };
          // Primero guardamos el registro y después dejamos pasar el error,
          // así la pantalla ya puede mostrar el detalle en la modal.
          return from(origen.guardarPeticion(registro)).pipe(switchMap(() => throwError(() => err)));
        }),
      );
    }),
  );
};

function aObjeto(h: HttpHeaders): Record<string, string> {
  const r: Record<string, string> = {};
  for (const k of h.keys()) r[k] = h.getAll(k)?.join(', ') ?? '';
  return r;
}

/** Explica en español por qué falló la petición. */
function describirError(err: unknown): string {
  if ((err as Error)?.name === 'TimeoutError') {
    return `Tiempo agotado: el servidor no respondió en ${ESPERA_MS / 1000} s.`;
  }
  if (!(err instanceof HttpErrorResponse)) return String((err as Error)?.message ?? err);

  const delServidor: string | undefined = err.error?.error;
  if (err.status === 0) {
    return 'No hubo respuesta del servidor. Revisa que XAMPP esté encendido, la IP y el puerto '
      + 'en Origen de datos, el firewall de Windows y que exista la carpeta fithabitos_api en htdocs.';
  }
  if (err.status === 404 && !delServidor) return 'HTTP 404: no se encontró fithabitos_api/v1/index.php en htdocs.';
  return `HTTP ${err.status}${delServidor ? ' → ' + delServidor : ' ' + (err.statusText || '')}`.trim();
}
