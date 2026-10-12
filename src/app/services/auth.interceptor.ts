import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/** Llave de localStorage donde AuthService guarda el token al hacer login. */
export const CLAVE_TOKEN = 'fh_token';

/**
 * Interceptor de autenticación.
 *
 * 1. A cada petición le agrega la cabecera  Authorization: Bearer <token>
 *    (excepto a /auth/login y /auth/registro, que no lo necesitan).
 * 2. Si la API responde 401 (token vencido o inválido), borra la sesión
 *    y manda al usuario a la pantalla de login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const esPublica = /\/auth\/(login|registro)$/.test(req.url);

  let token: string | null = null;
  try {
    token = localStorage.getItem(CLAVE_TOKEN);
  } catch {
    token = null;
  }

  const peticion =
    token && !esPublica
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(peticion).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !esPublica) {
        localStorage.removeItem(CLAVE_TOKEN);
        localStorage.removeItem('usuario');
        router.navigateByUrl('/login', { replaceUrl: true });
      }
      return throwError(() => err);
    }),
  );
};
