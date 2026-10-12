import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { AlertController, ModalController, ToastController } from '@ionic/angular/lazy';
import { firstValueFrom, Subscription } from 'rxjs';
import { FitHabitosApiService } from '../services/fithabitos-api.service';
import { LoadingService } from '../services/loading.service';
import { ServidorService } from '../services/servidor.service';
import { CARPETA_API_REST } from '../services/api.interceptor';
import { ErrorApi, Habito, HabitoNuevo } from '../models/api.models';
import { RegistroPeticion } from '../services/peticion.model';
import { ErrorPeticionComponent } from '../compartido/error-peticion.component';
import { HabitoFormComponent } from './habito-form/habito-form.component';
import { categoria } from './categorias';
import { registrarIconos } from '../services/iconos';

/**
 * "Mis hábitos": CRUD completo contra la API REST.
 *
 *   GET    /habitos       al entrar y al jalar para refrescar
 *   POST   /habitos       botón "+"
 *   PUT    /habitos/{id}  tocar un hábito y guardar el formulario
 *   PATCH  /habitos/{id}  interruptor activo / pausado
 *   DELETE /habitos/{id}  botón de basura (con confirmación)
 *
 * El loading lo pone el interceptor; aquí solo manejamos la respuesta o el error.
 */
@Component({
  selector: 'app-habitos',
  templateUrl: './habitos.page.html',
  styleUrls: ['./habitos.page.scss'],
  standalone: false,
})
export class HabitosPage implements OnInit, OnDestroy {
  habitos: Habito[] = [];
  /** Ya intentamos cargar al menos una vez (para no mostrar "vacío" antes de tiempo). */
  cargado = false;
  /** Error de la última carga de la lista (muestra la tarjeta de error). */
  errorCarga: ErrorApi | null = null;
  /** Última petición hecha (método, URL, estado, duración). */
  ultima: RegistroPeticion | null = null;
  urlApi = '';
  /** Id del hábito cuyo interruptor está esperando respuesta. */
  cambiandoId: number | null = null;

  readonly categoria = categoria;
  private sub?: Subscription;

  constructor(
    private api: FitHabitosApiService,
    readonly loading: LoadingService,
    private origen: ServidorService,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private location: Location,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    registrarIconos();
  }

  ngOnInit() {
    this.sub = this.origen.cambios$.subscribe(d => {
      if (!d) return;
      this.ultima = d.ultimaPeticion;
      this.urlApi = `${ServidorService.urlBase(d.conexion)}/${CARPETA_API_REST}`;
      this.refrescar();
    });
    this.origen.leer();
    this.cargar();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  get activos(): number {
    return this.habitos.filter(h => h.activo).length;
  }

  // ======================= GET =======================

  /** Carga la lista. Desde el refresher no se muestra el loading (ya hay spinner). */
  async cargar(evento?: CustomEvent) {
    try {
      this.habitos = await firstValueFrom(this.api.listarHabitos(evento ? null : 'Cargando hábitos…'));
      this.errorCarga = null;
    } catch (e) {
      this.errorCarga = this.comoError(e);
      if (this.habitos.length) this.avisoError(this.errorCarga);
    } finally {
      this.cargado = true;
      (evento?.target as HTMLIonRefresherElement | undefined)?.complete();
      this.refrescar();
    }
  }

  // ======================= POST / PUT =======================

  async abrirFormulario(habito: Habito | null = null) {
    const modal = await this.modalCtrl.create({
      component: HabitoFormComponent,
      componentProps: { habito },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<HabitoNuevo>();
    if (role !== 'guardar' || !data) return;

    try {
      if (habito) {
        const actualizado = await firstValueFrom(this.api.editarHabito(habito.id, data));
        this.habitos = this.habitos.map(h => (h.id === actualizado.id ? actualizado : h));
        this.aviso(`"${actualizado.nombre}" se actualizó (PUT 200).`);
      } else {
        const nuevo = await firstValueFrom(this.api.crearHabito(data));
        this.habitos = [nuevo, ...this.habitos];
        this.aviso(`"${nuevo.nombre}" se creó con id ${nuevo.id} (POST 201).`);
      }
    } catch (e) {
      this.avisoError(this.comoError(e));
    }
    this.refrescar();
  }

  // ======================= PATCH =======================

  async cambiarActivo(habito: Habito, evento: Event) {
    evento.stopPropagation();
    const activo = !habito.activo;
    // Actualización optimista: se ve el cambio al instante y se revierte si falla
    habito.activo = activo;
    this.cambiandoId = habito.id;
    this.refrescar();
    try {
      const actualizado = await firstValueFrom(
        this.api.actualizarHabitoParcial(habito.id, { activo }, activo ? 'Activando…' : 'Pausando…'),
      );
      Object.assign(habito, actualizado);
      this.aviso(`"${habito.nombre}" ${activo ? 'activado' : 'pausado'} (PATCH 200).`);
    } catch (e) {
      habito.activo = !activo;
      this.avisoError(this.comoError(e));
    } finally {
      this.cambiandoId = null;
      this.refrescar();
    }
  }

  // ======================= DELETE =======================

  async eliminar(habito: Habito, evento: Event) {
    evento.stopPropagation();
    const alerta = await this.alertCtrl.create({
      header: '¿Eliminar hábito?',
      message: `Se borrará "${habito.nombre}" del servidor.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    if (role !== 'destructive') return;

    try {
      await firstValueFrom(this.api.eliminarHabito(habito.id));
      this.habitos = this.habitos.filter(h => h.id !== habito.id);
      this.aviso(`"${habito.nombre}" se eliminó (DELETE 200).`);
    } catch (e) {
      this.avisoError(this.comoError(e));
    }
    this.refrescar();
  }

  // ======================= RESPUESTAS Y ERRORES =======================

  /** Modal con todo el detalle de la última petición (cabeceras, payload, respuesta). */
  async verDetalle() {
    const { ultimaPeticion } = await this.origen.leer();
    const modal = await this.modalCtrl.create({
      component: ErrorPeticionComponent,
      componentProps: {
        registro: ultimaPeticion,
        titulo: ultimaPeticion?.exito ? 'Última petición' : 'Error en la petición',
        puedeReintentar: true,
      },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'reintentar') this.cargar();
    if (role === 'origen') this.router.navigateByUrl('/origen-datos');
  }

  cambiarRedLenta(evento: Event) {
    this.loading.redLenta = (evento as CustomEvent).detail.checked;
  }

  volver() {
    if (window.history.length > 1) this.location.back();
    else this.router.navigateByUrl('/inicio');
  }

  private comoError(e: unknown): ErrorApi {
    const err = e as ErrorApi;
    if (!err?.status) {
      // Esta pantalla no guarda nada offline: lo decimos claro
      return { status: 0, mensaje: 'No se pudo conectar con el servidor. Revisa XAMPP y la IP en Origen de datos.' };
    }
    return { status: err.status, mensaje: err.mensaje ?? 'Ocurrió un error inesperado' };
  }

  private async aviso(mensaje: string) {
    const t = await this.toastCtrl.create({
      message: mensaje, duration: 2200, position: 'bottom', color: 'dark', icon: 'checkmark-circle-outline',
    });
    await t.present();
  }

  private async avisoError(error: ErrorApi) {
    const t = await this.toastCtrl.create({
      message: error.status ? `${error.mensaje} (HTTP ${error.status})` : error.mensaje,
      duration: 4500,
      position: 'bottom',
      color: 'danger',
      icon: 'alert-circle-outline',
      buttons: [{ text: 'Ver detalle', handler: () => { this.verDetalle(); } }],
    });
    await t.present();
  }

  /** La app no usa zone.js: avisamos a Angular que repinte. */
  private refrescar() {
    this.cdr.markForCheck();
  }
}
