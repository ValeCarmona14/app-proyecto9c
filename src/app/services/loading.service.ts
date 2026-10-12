import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular/lazy';
import { BehaviorSubject } from 'rxjs';

/**
 * Muestra UN solo "loading" de Ionic mientras haya peticiones en curso.
 *
 * Lo usa loading.interceptor.ts: cada petición llama a mostrar() al salir
 * y a ocultar() al terminar (bien o mal). Lleva la cuenta de cuántas van,
 * así si salen dos peticiones juntas no aparecen dos loadings encimados.
 */
@Injectable({ providedIn: 'root' })
export class LoadingService {
  /** true mientras haya al menos una petición en curso (para spinners en línea). */
  readonly cargando$ = new BehaviorSubject<boolean>(false);

  /**
   * Solo para la demo/video: hace que la API tarde 2 s en responder
   * (manda ?demora=2) para que se aprecie el loading.
   */
  redLenta = false;

  private activas = 0;
  private loading?: HTMLIonLoadingElement;
  private creando: Promise<void> = Promise.resolve();

  constructor(private loadingCtrl: LoadingController) {}

  mostrar(mensaje = 'Cargando…'): void {
    this.activas++;
    this.cargando$.next(true);

    if (this.activas > 1) {
      // Ya hay uno en pantalla: solo actualizamos el texto
      if (this.loading) this.loading.message = mensaje;
      return;
    }

    this.creando = this.creando.then(async () => {
      if (this.activas === 0) return; // la petición terminó antes de crear el loading
      const l = await this.loadingCtrl.create({
        message: mensaje,
        spinner: 'crescent',
        cssClass: 'fh-loading',
        backdropDismiss: false,
      });
      this.loading = l;
      await l.present();
      // Si mientras se presentaba ya terminaron todas, lo quitamos
      if (this.activas === 0) await this.cerrar();
    });
  }

  ocultar(): void {
    this.activas = Math.max(0, this.activas - 1);
    if (this.activas > 0) return;
    this.cargando$.next(false);
    this.creando = this.creando.then(() => this.cerrar());
  }

  private async cerrar() {
    const l = this.loading;
    this.loading = undefined;
    if (l) await l.dismiss().catch(() => undefined);
  }
}
