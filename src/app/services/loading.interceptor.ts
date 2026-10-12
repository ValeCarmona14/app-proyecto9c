import { HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from './loading.service';

/**
 * Texto del loading para una petición. Ejemplo:
 *   this.http.get(url, { context: new HttpContext().set(MENSAJE_LOADING, 'Cargando hábitos…') })
 * Si vale null, la petición NO muestra loading (por ejemplo, al jalar para refrescar,
 * donde ya se ve el spinner del ion-refresher).
 */
export const MENSAJE_LOADING = new HttpContextToken<string | null>(() => 'Cargando…');

/**
 * Interceptor de loading: muestra el ion-loading mientras la petición está en
 * curso y lo quita al terminar, ya sea con éxito, con error o si se cancela.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const mensaje = req.context.get(MENSAJE_LOADING);
  if (mensaje === null) return next(req);

  const loading = inject(LoadingService);
  loading.mostrar(mensaje);
  return next(req).pipe(finalize(() => loading.ocultar()));
};
