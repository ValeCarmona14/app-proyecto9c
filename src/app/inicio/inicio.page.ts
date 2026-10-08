import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ActionSheetController, AlertController, ModalController, ToastController } from '@ionic/angular/lazy';
import { Subscription } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { DatosService, EstadoSync } from '../services/datos.service';
import { DiaComponent } from './dia/dia.component';
import { aISO } from '../services/utiles';
import { registrarIconos } from '../services/iconos';
import { RegistroPeticion } from '../services/peticion.model';
import { ServidorService } from '../services/servidor.service';
import { ErrorPeticionComponent } from '../compartido/error-peticion.component';

interface Celda {
  fecha: string;
  numero: number;
  delMes: boolean;
  activo: boolean;
  etiqueta: string;
}

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.page.html',
  styleUrls: ['./inicio.page.scss'],
  standalone: false,
})
export class InicioPage implements OnInit, OnDestroy {
  readonly diasSemana = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  hoy = aISO(new Date());
  hoyLargo = '';
  anio = new Date().getFullYear();
  mes = new Date().getMonth();
  nombreMes = '';
  celdas: Celda[] = [];
  direccion = 0;
  nombre = '';
  estado: EstadoSync = 'al-dia';
  fondo: string | null = null;
  fondoCss: string | null = null;
  /** Detalle de la última sincronización fallida (cabeceras, payload, IP destino). */
  errorSync: RegistroPeticion | null = null;
  private modalErrorAbierta = false;
  @ViewChild('archivo') archivo!: ElementRef<HTMLInputElement>;

  readonly textoEstado: Record<EstadoSync, string> = {
    'al-dia': 'Guardado',
    pendiente: 'Por subir',
    'sin-conexion': 'Sin conexión',
    sincronizando: 'Subiendo',
  };
  readonly iconoEstado: Record<EstadoSync, string> = {
    'al-dia': 'cloud-done-outline',
    pendiente: 'cloud-upload-outline',
    'sin-conexion': 'cloud-offline-outline',
    sincronizando: 'sync-outline',
  };

  private subs: Subscription[] = [];
  private xInicio = 0;

  constructor(
    private auth: AuthService,
    private datos: DatosService,
    private modalCtrl: ModalController,
    private actionCtrl: ActionSheetController,
    private alertCtrl: AlertController,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toastCtrl: ToastController,
    private origen: ServidorService,
  ) {
    registrarIconos();
  }

  ngOnInit() {
    this.subs.push(this.datos.estado$.subscribe(e => { this.estado = e; this.cdr.markForCheck(); }));
    this.subs.push(this.datos.error$.subscribe(r => { this.errorSync = r; this.cdr.markForCheck(); }));
    this.subs.push(this.datos.cambios$.subscribe(() => { this.armarMes(); this.cdr.markForCheck(); }));
    this.alEntrar();
  }

  // Se llama al crear la página y cada vez que vuelves a ella
  ionViewWillEnter() {
    this.alEntrar();
  }

  private alEntrar() {
    this.nombre = this.auth.getNombre();
    this.ponerFondo(this.datos.fondo());
    // Por si la app se quedó abierta de un día para otro
    this.hoy = aISO(new Date());
    this.hoyLargo = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    this.armarMes();
    this.cdr.markForCheck();
    this.datos.sincronizar();
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
  }

  get esMesActual(): boolean {
    const h = new Date();
    return h.getFullYear() === this.anio && h.getMonth() === this.mes;
  }

  porFecha = (_: number, c: Celda) => c.fecha;

  armarMes() {
    this.nombreMes = new Date(this.anio, this.mes, 1).toLocaleDateString('es-MX', { month: 'long' });
    const activos = this.datos.diasConActividad(this.anio, this.mes);

    // Lunes = 0 ... Domingo = 6
    const primero = new Date(this.anio, this.mes, 1);
    const huecoInicial = (primero.getDay() + 6) % 7;
    const inicio = new Date(this.anio, this.mes, 1 - huecoInicial);
    const diasDelMes = new Date(this.anio, this.mes + 1, 0).getDate();
    const total = Math.ceil((huecoInicial + diasDelMes) / 7) * 7;

    this.celdas = Array.from({ length: total }, (_, i) => {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      const fecha = aISO(d);
      return {
        fecha,
        numero: d.getDate(),
        delMes: d.getMonth() === this.mes,
        activo: activos.has(fecha),
        etiqueta: d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }) +
          (fecha === this.hoy ? ', hoy' : '') + (activos.has(fecha) ? ', con registros' : ''),
      };
    });
  }

  moverMes(paso: number) {
    const d = new Date(this.anio, this.mes + paso, 1);
    this.anio = d.getFullYear();
    this.mes = d.getMonth();
    this.direccion = 0;
    requestAnimationFrame(() => { this.direccion = paso; this.cdr.markForCheck(); });
    this.armarMes();
  }

  irAHoy() {
    const h = new Date();
    const paso = h < new Date(this.anio, this.mes, 1) ? -1 : 1;
    this.anio = h.getFullYear();
    this.mes = h.getMonth();
    this.direccion = 0;
    requestAnimationFrame(() => { this.direccion = paso; this.cdr.markForCheck(); });
    this.armarMes();
  }

  // Deslizar el dedo a los lados cambia de mes
  toqueInicio(e: TouchEvent) { this.xInicio = e.changedTouches[0].clientX; }
  toqueFin(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - this.xInicio;
    if (Math.abs(dx) > 60) this.moverMes(dx < 0 ? 1 : -1);
  }

  async abrirDia(fecha: string) {
    const modal = await this.modalCtrl.create({
      component: DiaComponent,
      componentProps: { fecha },
      cssClass: 'hoja-dia',
      breakpoints: [0, 0.6, 1],
      initialBreakpoint: 0.6,
      handle: true,
    });
    await modal.present();
    await modal.onDidDismiss();
    this.armarMes(); // actualiza los puntitos
    this.cdr.markForCheck();
  }

  /** Toque en el chip de estado: si hubo error muestra el detalle; si no, sincroniza. */
  async sincronizarAhora() {
    if (this.errorSync) return this.abrirError(this.errorSync);
    await this.datos.sincronizar();
    if (this.errorSync) this.abrirError(this.errorSync);
  }

  /** Modal con todos los datos de la petición: IP destino, cabeceras, payload y respuesta. */
  async abrirError(registro: RegistroPeticion | null, titulo = 'Error al sincronizar', puedeReintentar = true) {
    if (this.modalErrorAbierta) return;
    this.modalErrorAbierta = true;
    const modal = await this.modalCtrl.create({
      component: ErrorPeticionComponent,
      componentProps: { registro, titulo, puedeReintentar },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    this.modalErrorAbierta = false;

    if (role === 'reintentar') {
      await this.datos.sincronizar();
      if (this.errorSync) this.abrirError(this.errorSync);
      else this.aviso('¡Listo! Ya se sincronizó.');
    } else if (role === 'origen') {
      this.router.navigateByUrl('/origen-datos');
    }
  }

  async verUltimaPeticion() {
    const { ultimaPeticion } = await this.origen.leer();
    this.abrirError(ultimaPeticion, 'Última petición', false);
  }

  async abrirCuenta() {
    const hoja = await this.actionCtrl.create({
      header: this.auth.getUsuario()?.email ?? 'Tu cuenta',
      buttons: [
        {
          text: this.fondo ? 'Cambiar foto de fondo' : 'Poner foto de fondo',
          icon: 'image-outline',
          handler: () => this.archivo.nativeElement.click(),
        },
        ...(this.fondo
          ? [{ text: 'Quitar foto de fondo', icon: 'trash-outline', handler: () => this.quitarFondo() }]
          : []),
        { text: 'Origen de datos', icon: 'server-outline', handler: () => { this.router.navigateByUrl('/origen-datos'); } },
        { text: 'Ver última petición', icon: 'alert-circle-outline', handler: () => { this.verUltimaPeticion(); } },
        { text: 'Crear cuenta nueva', icon: 'person-add-outline', handler: () => this.salir(true) },
        { text: 'Cerrar sesión', icon: 'log-out-outline', role: 'destructive', handler: () => this.salir(false) },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await hoja.present();
  }

  // ==================== FOTO DE FONDO ====================

  async fotoElegida(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = ''; // para poder elegir la misma foto otra vez
    if (!archivo) return;

    try {
      const dataUrl = await this.reducirFoto(archivo);
      if (!this.datos.guardarFondo(dataUrl)) {
        return this.aviso('La foto es muy pesada para guardarla. Prueba con otra.');
      }
      this.ponerFondo(dataUrl);
    } catch {
      this.aviso('No se pudo abrir esa imagen. Prueba con una foto JPG o PNG.');
    }
  }

  quitarFondo() {
    this.datos.guardarFondo(null);
    this.ponerFondo(null);
  }

  /** Arma el fondo: capa clara encima de la foto, para que se lea el calendario. */
  private ponerFondo(dataUrl: string | null) {
    this.fondo = dataUrl;
    this.fondoCss = dataUrl
      ? `linear-gradient(rgba(251, 245, 246, 0.78), rgba(251, 245, 246, 0.62)), url(${dataUrl}) center / cover no-repeat`
      : null;
    this.cdr.markForCheck();
  }

  /** Achica la foto (máx. 1600 px) y la comprime para que no pese tanto. */
  private reducirFoto(archivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(); };
      img.src = url;
    });
  }

  private async aviso(msg: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 3000, position: 'bottom', color: 'dark' });
    await t.present();
  }

  private async salir(crearNueva: boolean) {
    await this.datos.sincronizar();
    const pendientes = this.datos.pendientes();
    if (pendientes > 0) {
      const alerta = await this.alertCtrl.create({
        header: 'Hay cambios sin subir',
        message: `Tienes ${pendientes} cambio(s) que aún no llegan al servidor. Se quedan guardados en este teléfono y se subirán cuando vuelvas a entrar con esta cuenta y haya conexión.`,
        buttons: [
          { text: 'Quedarme', role: 'cancel' },
          { text: 'Salir de todos modos', role: 'confirm' },
        ],
      });
      await alerta.present();
      const { role } = await alerta.onDidDismiss();
      if (role !== 'confirm') return;
    }
    this.auth.cerrarSesion();
    this.router.navigate(['/login'], {
      replaceUrl: true,
      queryParams: crearNueva ? { modo: 'registro' } : {},
    });
  }
}
