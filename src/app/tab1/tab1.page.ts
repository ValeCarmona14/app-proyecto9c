import { Component, ElementRef, ViewChild, NgZone } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {
  @ViewChild('msform', { static: true })
  msform!: ElementRef<HTMLFormElement>;

  /** datos del registro (coinciden con la tabla usuarios) */
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

  cargando = false;
  mensaje = '';
  tipoMensaje: 'exito' | 'error' = 'exito';

  private animating = false; // evita glitches por multi-click rápido

  constructor(private auth: AuthService, private zone: NgZone) {}

  // ==================== ENVIAR REGISTRO (POST) ====================
  async submit(): Promise<void> {
    this.mensaje = '';
    if (!this.data.email || !this.data.password) {
      this.mostrar('El email y la contraseña son obligatorios.', 'error');
      return;
    }
    if (this.data.password !== this.data.cpassword) {
      this.mostrar('Las contraseñas no coinciden.', 'error');
      return;
    }

    this.cargando = true;
    try {
      const res = await this.auth.registrar(this.data);
      // axios corre fuera de Angular; NgZone.run asegura que la vista se refresque
      this.zone.run(() => {
        this.cargando = false;
        if (res.ok) {
          this.mostrar('¡Cuenta creada! Ya se puede iniciar sesión.', 'exito');
          this.limpiar();
        } else {
          this.mostrar(res.error || 'No se pudo registrar.', 'error');
        }
      });
    } catch {
      this.zone.run(() => {
        this.cargando = false;
        this.mostrar('No se pudo conectar con el servidor.', 'error');
      });
    }
  }

  private mostrar(texto: string, tipo: 'exito' | 'error'): void {
    this.mensaje = texto;
    this.tipoMensaje = tipo;
  }

  private limpiar(): void {
    this.data = {
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
  }

  // ==================== ANIMACIÓN MULTISTEP ====================
  next(target: EventTarget | null): void {
    if (this.animating || !target) return;
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
    if (this.animating || !target) return;
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

  /** Reemplaza a $.animate: llama a `step(now)` con now de 1 -> 0 */
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

  /** Easing que en el original venía del plugin de jQuery */
  private easeInOutBack(x: number): number {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return x < 0.5
      ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
      : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2;
  }
}
