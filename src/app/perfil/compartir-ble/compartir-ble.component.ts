import { ChangeDetectorRef, Component, Input, NgZone, OnDestroy, OnInit } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular/lazy';
import { FotoPerfil, FotoPerfilService, DatoMeta } from '../../services/foto-perfil.service';
import { CompartirBleService, DispositivoBle } from '../../services/ble/compartir-ble.service';
import { PaqueteMeta } from '../../services/ble/protocolo-ble';
import { SolicitudBle } from '../../services/ble/periferico-ble';
import { registrarIconos } from '../../services/iconos';

type Modo = 'enviar' | 'recibir';
type FaseEnvio = 'inactivo' | 'conectando' | 'esperando' | 'enviando' | 'confirmando' | 'enviado' | 'rechazado' | 'error';
type FaseRecepcion = 'apagado' | 'activando' | 'esperando' | 'pidiendo' | 'recibiendo';

/**
 * Modal "Compartir metadata por Bluetooth".
 *  - Enviar (celular A): busca celulares, se conecta y manda la metadata.
 *  - Recibir (celular B): se hace visible, pregunta si acepta la conexión
 *    y al aceptar muestra la metadata que llegó.
 */
@Component({
  selector: 'app-compartir-ble',
  templateUrl: './compartir-ble.component.html',
  styleUrls: ['./compartir-ble.component.scss'],
  standalone: false,
})
export class CompartirBleComponent implements OnInit, OnDestroy {
  @Input() foto: FotoPerfil | null = null;
  @Input() nombre = '';

  modo: Modo = 'enviar';
  readonly pasos = ['Conectar', 'Aceptar', 'Enviar', 'Listo'];

  // ---- Enviar ----
  principales: DatoMeta[] = [];
  totalDatos = 0;
  buscando = false;
  buscado = false;
  ubicacionOff = false;
  encontrados: DispositivoBle[] = [];
  fase: FaseEnvio = 'inactivo';
  pct = 0;
  destino = '';
  errorEnvio = '';

  // ---- Recibir ----
  recepcion: FaseRecepcion = 'apagado';
  pctRecepcion = 0;
  remitente = '';
  recibido: PaqueteMeta | null = null;
  verTodo = false;
  errorRecepcion = '';
  private alerta: HTMLIonAlertElement | null = null;

  constructor(
    private ble: CompartirBleService,
    private fotos: FotoPerfilService,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {
    registrarIconos();
  }

  get disponible(): boolean { return this.ble.disponible; }
  get ocupado(): boolean { return ['conectando', 'esperando', 'enviando', 'confirmando'].includes(this.fase); }
  get visible(): boolean { return !['apagado', 'activando'].includes(this.recepcion); }

  /** Qué paso del 0 al 3 va el envío (para el indicador de pasos). */
  get pasoActual(): number {
    return ({ conectando: 0, esperando: 1, rechazado: 1, enviando: 2, confirmando: 2, enviado: 3 } as Record<string, number>)[this.fase] ?? -1;
  }

  ngOnInit() {
    // Si no hay foto no hay nada que enviar: abrimos directo en "Recibir"
    this.modo = this.foto ? 'enviar' : 'recibir';
    if (this.foto) {
      this.principales = this.fotos.principales(this.foto);
      this.totalDatos = this.fotos.todos(this.foto).length;
    }
  }

  ngOnDestroy() {
    this.ble.detenerBusqueda();
    this.ble.dejarDeSerVisible();
    this.alerta?.dismiss();
  }

  cerrar() {
    this.modalCtrl.dismiss();
  }

  /** Los eventos del Bluetooth llegan fuera de Angular: así se refresca la pantalla. */
  private actualizar(fn: () => void) {
    this.zone.run(() => {
      fn();
      this.cdr.markForCheck();
    });
  }

  async cambiarModo(m: any) {
    if (m === this.modo) return;
    this.modo = m as Modo;
    // Un celular no puede buscar y estar visible a la vez
    if (this.modo === 'recibir') {
      await this.ble.detenerBusqueda();
    } else if (this.visible || this.recepcion === 'activando') {
      await this.dejarDeSerVisible();
    }
    this.cdr.markForCheck();
  }

  // ==================== CELULAR A: ENVIAR ====================

  async buscar() {
    this.encontrados = [];
    this.errorEnvio = '';
    this.buscando = true;
    this.buscado = true;
    if (this.fase === 'enviado' || this.fase === 'rechazado' || this.fase === 'error') this.fase = 'inactivo';
    this.cdr.markForCheck();
    try {
      this.ubicacionOff = await this.ble.ubicacionApagada();
      await this.ble.buscar(d => this.actualizar(() => {
        const ya = this.encontrados.find(x => x.id === d.id);
        if (ya) Object.assign(ya, d);
        else this.encontrados = [...this.encontrados, d].sort((a, b) => b.rssi - a.rssi);
      }));
    } catch (e) {
      this.actualizar(() => (this.errorEnvio = textoError(e)));
    } finally {
      this.actualizar(() => (this.buscando = false));
    }
  }

  detenerBusqueda() {
    this.ble.detenerBusqueda();
  }

  abrirUbicacion() {
    this.ble.abrirAjustesUbicacion();
  }

  async enviarA(d: DispositivoBle) {
    if (!this.foto || this.ocupado) return;
    this.destino = d.nombre;
    this.errorEnvio = '';
    this.pct = 0;
    this.fase = 'conectando';
    this.cdr.markForCheck();
    try {
      const paquete = await this.ble.armarPaquete(this.foto, this.nombre);
      const r = await this.ble.enviar(d.id, paquete, p => this.actualizar(() => {
        this.fase = p.fase;
        if (p.fase === 'enviando') this.pct = p.pct;
      }));
      this.actualizar(() => (this.fase = r));
    } catch (e) {
      this.actualizar(() => {
        this.fase = 'error';
        this.errorEnvio = textoError(e);
      });
    }
  }

  nivelSenal(rssi: number): number {
    return rssi >= -60 ? 4 : rssi >= -70 ? 3 : rssi >= -80 ? 2 : 1;
  }

  // ==================== CELULAR B: RECIBIR ====================

  async alternarVisible() {
    if (this.visible) return this.dejarDeSerVisible();
    this.errorRecepcion = '';
    this.recepcion = 'activando';
    this.cdr.markForCheck();
    try {
      await this.ble.hacerseVisible(this.nombre, {
        solicitud: s => this.actualizar(() => this.preguntar(s)),
        progreso: p => this.actualizar(() => {
          this.recepcion = 'recibiendo';
          this.pctRecepcion = Math.round((p.recibidos / p.total) * 100);
        }),
        recibido: paquete => this.actualizar(() => {
          this.recibido = paquete;
          this.verTodo = false;
          this.recepcion = 'esperando';
        }),
        desconectado: d => this.actualizar(() => {
          this.alerta?.dismiss(null, 'cortado');
          if (this.recepcion === 'pidiendo' || this.recepcion === 'recibiendo') {
            this.errorRecepcion = `${d.de || 'El otro celular'} se desconectó antes de terminar.`;
          }
          this.recepcion = 'esperando';
        }),
        error: msg => this.actualizar(() => {
          this.errorRecepcion = msg;
          this.recepcion = 'esperando';
        }),
      });
      this.actualizar(() => (this.recepcion = 'esperando'));
    } catch (e) {
      this.actualizar(() => {
        this.recepcion = 'apagado';
        this.errorRecepcion = textoError(e);
      });
    }
  }

  private async dejarDeSerVisible() {
    await this.ble.dejarDeSerVisible();
    this.actualizar(() => (this.recepcion = 'apagado'));
  }

  /** El celular A pidió conectarse: le preguntamos al usuario. */
  private async preguntar(s: SolicitudBle) {
    this.remitente = s.de;
    this.errorRecepcion = '';
    this.recepcion = 'pidiendo';
    this.alerta?.dismiss(null, 'cortado');
    this.alerta = await this.alertCtrl.create({
      header: 'Solicitud de conexión',
      message: `${s.de} quiere conectarse por Bluetooth para enviarte la metadata de su foto (${kb(s.bytes)}). ¿Aceptas?`,
      backdropDismiss: false,
      buttons: [
        { text: 'Rechazar', role: 'cancel' },
        { text: 'Aceptar', role: 'confirm' },
      ],
    });
    await this.alerta.present();
    const { role } = await this.alerta.onDidDismiss();
    this.alerta = null;
    if (role === 'cortado') return; // el otro celular se fue mientras preguntábamos

    const aceptar = role === 'confirm';
    try {
      await this.ble.responder(aceptar);
      this.actualizar(() => {
        this.recepcion = aceptar ? 'recibiendo' : 'esperando';
        this.pctRecepcion = 0;
      });
    } catch (e) {
      this.actualizar(() => {
        this.recepcion = 'esperando';
        this.errorRecepcion = textoError(e);
      });
    }
  }

  recibirOtra() {
    this.recibido = null;
    this.cdr.markForCheck();
  }

  urlMapa(g: { lat: number; lon: number }): string {
    return `https://www.google.com/maps?q=${g.lat},${g.lon}`;
  }

  horaRecibido(iso: string): string {
    const d = new Date(iso);
    return isNaN(+d) ? '' : d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  }
}

function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}

/** Los errores del Bluetooth vienen en inglés: los explicamos en español. */
function textoError(e: any): string {
  const m = String(e?.message ?? e ?? '');
  if (/timeout|timed out/i.test(m)) return 'Se agotó el tiempo. Acerca los celulares e intenta otra vez.';
  if (/permission|denied/i.test(m)) return 'Falta el permiso de Bluetooth (Dispositivos cercanos). Dalo en los ajustes de la app.';
  if (/not enabled|disabled|turned off/i.test(m)) return 'Activa el Bluetooth para continuar.';
  if (/not implemented|unimplemented/i.test(m)) return 'Esta función solo está disponible en la app de Android.';
  if (/connect/i.test(m) && !/[áéíóú]/.test(m)) return 'No se pudo conectar con ese celular. Revisa que siga en "Recibir".';
  return m || 'Algo salió mal con el Bluetooth.';
}
