import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { BleClient, ScanResult } from '@capacitor-community/bluetooth-le';
import { FotoPerfil, FotoPerfilService } from '../foto-perfil.service';
import {
  CANAL, ESTADO, EST, FABRICANTE_PRUEBAS, MSG, PaqueteMeta, SERVICIO,
  aBytes, cabeceraSolicitud, deBytes, esPaquete, mensaje,
} from './protocolo-ble';
import { DesconectadoBle, PerifericoBle, ProgresoBle, SolicitudBle } from './periferico-ble';

export interface DispositivoBle {
  id: string;
  nombre: string;
  rssi: number;
}

export type PasoEnvio =
  | { fase: 'conectando' }
  | { fase: 'esperando' }
  | { fase: 'enviando'; pct: number }
  | { fase: 'confirmando' };

export interface EventosRecepcion {
  solicitud: (s: SolicitudBle) => void;
  progreso: (p: ProgresoBle) => void;
  recibido: (paquete: PaqueteMeta) => void;
  desconectado: (d: DesconectadoBle) => void;
  error: (mensaje: string) => void;
}

/**
 * Enviar la metadata de la foto de perfil a otro celular por Bluetooth LE.
 *
 * Celular A (envía):  @capacitor-community/bluetooth-le
 *   busca → se conecta → pide permiso → manda la metadata en pedazos
 * Celular B (recibe): plugin nativo PerifericoBle
 *   se anuncia → recibe la solicitud → pregunta al usuario → arma la metadata
 */
@Injectable({ providedIn: 'root' })
export class CompartirBleService {
  private iniciado = false;
  private finBusqueda: (() => void) | null = null;
  private temporizador: any;

  constructor(private fotos: FotoPerfilService) {}

  /** Solo funciona en la app instalada en Android (el navegador no puede ser periférico). */
  get disponible(): boolean {
    return Capacitor.getPlatform() === 'android';
  }

  // ==================== PREPARAR ====================

  /** Pide permisos de Bluetooth y que esté encendido. */
  async prepararBluetooth(): Promise<void> {
    if (!this.disponible) throw new Error('El envío por Bluetooth solo funciona en la app instalada en Android.');
    if (!this.iniciado) {
      await BleClient.initialize();
      this.iniciado = true;
    }
    if (!(await BleClient.isEnabled())) {
      try { await BleClient.requestEnable(); } catch { /* el usuario dijo que no */ }
      if (!(await BleClient.isEnabled())) throw new Error('Activa el Bluetooth para continuar.');
    }
  }

  /** En varios Android la búsqueda no encuentra nada si la Ubicación está apagada. */
  async ubicacionApagada(): Promise<boolean> {
    try { return !(await BleClient.isLocationEnabled()); } catch { return false; }
  }

  abrirAjustesUbicacion() {
    BleClient.openLocationSettings().catch(() => {});
  }

  // ==================== CELULAR A: BUSCAR ====================

  /**
   * Busca celulares que tengan FitHábitos en modo "Recibir".
   * La promesa termina cuando acaba la búsqueda (por tiempo o por detenerBusqueda()).
   */
  async buscar(alEncontrar: (d: DispositivoBle) => void, segundos = 12): Promise<void> {
    await this.prepararBluetooth();
    await this.detenerBusqueda();
    const terminado = new Promise<void>(res => (this.finBusqueda = res));
    await BleClient.requestLEScan({ services: [SERVICIO], allowDuplicates: false }, r => {
      alEncontrar({ id: r.device.deviceId, nombre: nombreAnunciado(r), rssi: r.rssi ?? -100 });
    });
    this.temporizador = setTimeout(() => this.detenerBusqueda(), segundos * 1000);
    return terminado;
  }

  async detenerBusqueda(): Promise<void> {
    clearTimeout(this.temporizador);
    if (!this.finBusqueda) return;
    try { await BleClient.stopLEScan(); } catch { /* ya estaba detenida */ }
    const fin = this.finBusqueda;
    this.finBusqueda = null;
    fin();
  }

  // ==================== CELULAR A: ENVIAR ====================

  /** Conecta, pide permiso y manda el paquete. Regresa 'rechazado' si el otro dijo que no. */
  async enviar(id: string, paquete: PaqueteMeta, alPaso: (p: PasoEnvio) => void): Promise<'enviado' | 'rechazado'> {
    await this.detenerBusqueda();
    const resp = new Respuestas();

    alPaso({ fase: 'conectando' });
    await BleClient.connect(id, () => resp.desconectar(), { timeout: 15000 });

    try {
      // Cuánto cabe en cada escritura: MTU - 3, máximo 512 (límite de BLE), menos 1 byte de tipo
      const mtu = await BleClient.getMtu(id).catch(() => 23);
      const tam = Math.min(mtu - 3, 512) - 1;

      // Escuchamos lo que responda el celular B
      await BleClient.startNotifications(id, SERVICIO, ESTADO, v => resp.recibir(v.getUint8(0)));
      const leer = () => BleClient.read(id, SERVICIO, ESTADO).then(v => v.getUint8(0));

      // 1) Solicitud de conexión: el celular B le pregunta al usuario
      const datos = aBytes(JSON.stringify(paquete));
      const cabecera = cabeceraSolicitud(paquete.de, datos.length, tam);
      await BleClient.write(id, SERVICIO, CANAL, mensaje(MSG.SOLICITUD, cabecera));
      alPaso({ fase: 'esperando' });

      const respuesta = await resp.esperar([EST.ACEPTADO, EST.RECHAZADO], 60000, leer);
      if (respuesta === EST.RECHAZADO) return 'rechazado';

      // 2) La metadata, en pedazos
      for (let i = 0; i < datos.length; i += tam) {
        await BleClient.write(id, SERVICIO, CANAL, mensaje(MSG.PARTE, datos.subarray(i, i + tam)));
        alPaso({ fase: 'enviando', pct: Math.round((Math.min(i + tam, datos.length) / datos.length) * 100) });
      }

      // 3) Fin: el celular B revisa que llegó completo
      alPaso({ fase: 'confirmando' });
      await BleClient.write(id, SERVICIO, CANAL, mensaje(MSG.FIN));
      const fin = await resp.esperar([EST.RECIBIDO, EST.ERROR], 15000, leer);
      if (fin !== EST.RECIBIDO) throw new Error('El otro celular no recibió todo. Intenta otra vez.');
      return 'enviado';
    } finally {
      BleClient.stopNotifications(id, SERVICIO, ESTADO).catch(() => {});
      BleClient.disconnect(id).catch(() => {});
    }
  }

  /** Arma lo que se va a mandar: metadata de la foto + una miniatura. */
  async armarPaquete(foto: FotoPerfil, de: string): Promise<PaqueteMeta> {
    return {
      v: 1,
      de: de || 'Alguien',
      enviado: new Date().toISOString(),
      miniatura: await miniatura(foto.dataUrl, 160),
      principales: this.fotos.principales(foto),
      todos: this.fotos.todos(foto),
      gps: this.fotos.gps(foto),
    };
  }

  // ==================== CELULAR B: RECIBIR ====================

  /** Se anuncia por Bluetooth para que el celular A lo encuentre. */
  async hacerseVisible(nombre: string, ev: EventosRecepcion): Promise<void> {
    await this.prepararBluetooth();
    await PerifericoBle.removeAllListeners();
    await PerifericoBle.addListener('solicitud', ev.solicitud);
    await PerifericoBle.addListener('progreso', ev.progreso);
    await PerifericoBle.addListener('desconectado', ev.desconectado);
    await PerifericoBle.addListener('recibido', r => {
      try {
        const p = JSON.parse(r.datos);
        if (esPaquete(p)) ev.recibido(p);
        else ev.error('Llegaron datos que no son metadata de FitHábitos.');
      } catch {
        ev.error('Los datos llegaron dañados. Pide que te los vuelvan a enviar.');
      }
    });
    try {
      await PerifericoBle.iniciar({ nombre });
    } catch (e) {
      await PerifericoBle.removeAllListeners();
      throw e;
    }
  }

  responder(aceptar: boolean): Promise<void> {
    return PerifericoBle.responder({ aceptar });
  }

  async dejarDeSerVisible(): Promise<void> {
    try { await PerifericoBle.detener(); } catch { /* ya estaba detenido */ }
    try { await PerifericoBle.removeAllListeners(); } catch { /* nada que quitar */ }
  }
}

// ==================== AYUDANTES ====================

/** Espera la respuesta del celular B: por notificación y, de respaldo, leyendo ESTADO. */
class Respuestas {
  private ultimo: number = EST.ESPERANDO;
  private cortado = false;
  private avisar: (() => void) | null = null;

  recibir(estado: number) {
    this.ultimo = estado;
    this.avisar?.();
  }

  desconectar() {
    this.cortado = true;
    this.avisar?.();
  }

  esperar(validos: number[], ms: number, leer: () => Promise<number>): Promise<number> {
    return new Promise((resolve, reject) => {
      const limite = setTimeout(() => terminar(new Error('El otro celular no respondió a tiempo.')), ms);
      const respaldo = setInterval(() => leer().then(e => this.recibir(e)).catch(() => {}), 2000);
      const terminar = (error?: Error) => {
        clearTimeout(limite);
        clearInterval(respaldo);
        this.avisar = null;
        if (error) reject(error);
        else resolve(this.ultimo);
      };
      this.avisar = () => {
        if (validos.includes(this.ultimo)) terminar();
        else if (this.cortado) terminar(new Error('Se perdió la conexión con el otro celular.'));
      };
      this.avisar();
    });
  }
}

/** El nombre que anuncia el celular B (el de la persona); si no viene, el del celular. */
function nombreAnunciado(r: ScanResult): string {
  const dato = r.manufacturerData?.[String(FABRICANTE_PRUEBAS)];
  const nombre = dato ? deBytes(dato).trim() : '';
  return nombre || r.localName || r.device.name || 'Celular sin nombre';
}

/** Achica la foto para mandarla junto con la metadata. */
function miniatura(src: string, lado: number): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
