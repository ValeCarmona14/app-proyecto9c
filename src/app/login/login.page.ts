import { Component, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  @ViewChild('msform', { static: false })
  msform?: ElementRef<HTMLFormElement>;

  mode: 'login' | 'register' = 'login';
  cargando = false;
  mensaje = '';

  data = {
    email: '',
    password: '',
    cpassword: '',
    twitter: '',
    facebook: '',
    gplus: '',
    fname: '',
    lname: '',
    phone: '',
    address: '',
  };

  loginData = { email: '', password: '' };

  private animating = false;

  constructor(private auth: AuthService, private router: Router) {}

  cambiarModo(m: 'login' | 'register'): void {
    this.mode = m;
    this.mensaje = '';
  }

  // ==================== INICIAR SESIÓN ====================
  async login(): Promise<void> {
    this.mensaje = '';
    if (!this.loginData.email || !this.loginData.password) {
      this.mensaje = 'Escribe tu email y contraseña.';
      return;
    }
    this.cargando = true;
    try {
      const res = await this.auth.login(
        this.loginData.email,
        this.loginData.password
      );
      if (res.ok) {
        this.auth.guardarSesion(res.usuario);
        this.router.navigateByUrl('/tabs/tab3', { replaceUrl: true });
      } else {
        this.mensaje = res.error || 'Credenciales incorrectas.';
      }
    } catch {
      this.mensaje = 'No se pudo conectar con el servidor.';
    } finally {
      this.cargando = false;
    }
  }

  // ==================== REGISTRAR ====================
  async registrar(): Promise<void> {
    this.mensaje = '';
    if (!this.data.email || !this.data.password) {
      this.mensaje = 'El email y la contraseña son obligatorios.';
      return;
    }
    if (this.data.password !== this.data.cpassword) {
      this.mensaje = 'Las contraseñas no coinciden.';
      return;
    }
    this.cargando = true;
    try {
      const res = await this.auth.registrar(this.data);
      if (!res.ok) {
        this.mensaje = res.error || 'No se pudo registrar.';
        return;
      }
      const login = await this.auth.login(this.data.email, this.data.password);
      if (login.ok) {
        this.auth.guardarSesion(login.usuario);
        this.router.navigateByUrl('/tabs/tab3', { replaceUrl: true });
      } else {
        this.loginData.email = this.data.email;
        this.cambiarModo('login');
      }
    } catch {
      this.mensaje = 'No se pudo conectar con el servidor.';
    } finally {
      this.cargando = false;
    }
  }

  // ==================== ANIMACIÓN MULTISTEP ====================
  next(target: EventTarget | null): void {
    if (this.animating || !target || !this.msform) return;
    this.animating = true;

    const currentFs = (target as HTMLElement).closest('fieldset') as HTMLElement;
    const nextFs = currentFs.nextElementSibling as HTMLElement;

    const fieldsets = Array.from(
      this.msform.nativeElement.querySelectorAll<HTMLElement>('fieldset')
    );
    const bullets = this.msform.nativeElement.querySelectorAll('#progressbar li');
    bullets[fieldsets.indexOf(nextFs)]?.classList.add('active');

    nextFs.style.display = 'block';

    this.animate(
      800,
      (now) => {
        const scale = 1 - (1 - now) * 0.2;
        const left = now * 50 + '%';
        const opacity = 1 - now;
        currentFs.style.transform = `scale(${scale})`;
        currentFs.style.position = 'absolute';
        nextFs.style.left = left;
        nextFs.style.opacity = `${opacity}`;
      },
      () => {
        currentFs.style.display = 'none';
        this.animating = false;
      }
    );
  }

  previous(target: EventTarget | null): void {
    if (this.animating || !target || !this.msform) return;
    this.animating = true;

    const currentFs = (target as HTMLElement).closest('fieldset') as HTMLElement;
    const previousFs = currentFs.previousElementSibling as HTMLElement;

    const fieldsets = Array.from(
      this.msform.nativeElement.querySelectorAll<HTMLElement>('fieldset')
    );
    const bullets = this.msform.nativeElement.querySelectorAll('#progressbar li');
    bullets[fieldsets.indexOf(currentFs)]?.classList.remove('active');

    previousFs.style.display = 'block';

    this.animate(
      800,
      (now) => {
        const scale = 0.8 + (1 - now) * 0.2;
        const left = (1 - now) * 50 + '%';
        const opacity = 1 - now;
        currentFs.style.left = left;
        previousFs.style.transform = `scale(${scale})`;
        previousFs.style.opacity = `${opacity}`;
      },
      () => {
        currentFs.style.display = 'none';
        this.animating = false;
      }
    );
  }

  private animate(
    duration: number,
    step: (now: number) => void,
    complete: () => void
  ): void {
    const start = performance.now();
    const tick = (timestamp: number) => {
      const progress = Math.min((timestamp - start) / duration, 1);
      const now = 1 - this.easeInOutBack(progress);
      step(now);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        complete();
      }
    };
    requestAnimationFrame(tick);
  }

  private easeInOutBack(x: number): number {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return x < 0.5
      ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
      : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
  }
}
