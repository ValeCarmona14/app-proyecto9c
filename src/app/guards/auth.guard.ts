import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard que protege las pantallas privadas.
 * Si NO hay sesión, redirige al login y bloquea el acceso.
 */
@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    if (this.auth.estaLogueado()) {
      return true; // hay sesión -> deja pasar
    }
    return this.router.parseUrl('/login'); // no hay sesión -> al login
  }
}
