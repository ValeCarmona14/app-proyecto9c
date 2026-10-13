import { ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { ActionSheetController, ToastController } from '@ionic/angular/lazy';
import { Camera, MediaResult, MediaTypeSelection } from '@capacitor/camera';
import type { EditorApi } from 'photoeditorsdk/no-polyfills';
import { FotoEditada, FotosEditadasService } from '../services/fotos-editadas.service';
import { registrarIconos } from '../services/iconos';
import { TEXTOS_ES } from './pesdk-es';

/**
 * Licencia del PhotoEditor SDK (img.ly). Vacía = modo de prueba:
 * el editor funciona completo, pero pone una marca de agua en la foto.
 * Si te dan una licencia, pega aquí el texto completo.
 */
const LICENCIA_PESDK = '';

type Estado = 'inicio' | 'abriendo' | 'editando' | 'guardando';

/**
 * Pantalla "Editar foto":
 *  1. toma una foto con el plugin de cámara (@capacitor/camera)
 *  2. la abre en el PhotoEditor SDK (recortar, filtros, ajustes, texto, stickers, pincel, marcos…)
 *  3. al tocar "Guardar foto" guarda el archivo en una ruta local del teléfono
 */
@Component({
  selector: 'app-editor-foto',
  templateUrl: './editor-foto.page.html',
  styleUrls: ['./editor-foto.page.scss'],
  standalone: false,
})
export class EditorFotoPage implements OnDestroy {
  @ViewChild('lienzo', { static: true }) lienzo!: ElementRef<HTMLDivElement>;

  estado: Estado = 'inicio';
  ultima: FotoEditada | null = null;
  fotos: FotoEditada[] = [];
  cargandoLista = false;
  error = '';

  private editor: EditorApi | null = null;
  /** Termina cuando el editor anterior ya se cerró del todo. */
  private cierre: Promise<void> = Promise.resolve();

  constructor(
    private guardadas: FotosEditadasService,
    private actionCtrl: ActionSheetController,
    private toastCtrl: ToastController,
    private location: Location,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
  ) {
    registrarIconos();
  }

  ionViewWillEnter() {
    this.cargarLista();
  }

  ionViewWillLeave() {
    this.cerrarEditor();
  }

  ngOnDestroy() {
    this.cerrarEditor();
  }

  volver() {
    this.location.back();
  }

  /** Los eventos del editor llegan fuera de Angular: así se refresca la pantalla. */
  private actualizar(fn: () => void) {
    this.zone.run(() => {
      fn();
      this.cdr.markForCheck();
    });
  }

  // ==================== 1) TOMAR LA FOTO ====================

  async tomarFoto() {
    await this.desdeCamara(() => Camera.takePhoto({ quality: 92, correctOrientation: true }));
  }

  async elegirDeGaleria() {
    await this.desdeCamara(async () => {
      const { results } = await Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Photo, quality: 92 });
      if (!results.length) throw new Error('cancel');
      return results[0];
    });
  }

  private async desdeCamara(obtener: () => Promise<MediaResult>) {
    this.error = '';
    try {
      const r = await obtener();
      const src = r.webPath ?? (r.thumbnail ? `data:image/jpeg;base64,${r.thumbnail}` : null);
      if (!src) throw new Error('La cámara no regresó ninguna imagen.');
      await this.abrirEditor(src);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (!/cancel/i.test(msg)) this.actualizar(() => (this.error = 'No se pudo tomar la foto: ' + msg));
    }
  }

  // ==================== 2) EDITAR ====================

  private async abrirEditor(src: string) {
    if (this.editor) await this.cerrarEditor();
    this.actualizar(() => (this.estado = 'abriendo'));
    try {
      // El SDK se descarga solo cuando se usa (pesa varios MB)
      const [sdk, imagen] = await Promise.all([import('photoeditorsdk/no-polyfills'), cargarImagen(src)]);
      const { PhotoEditorSDKUI, UIEvent, ExportFormat, ImageFormat } = sdk;

      // El contenedor tiene que estar visible y con tamaño antes de iniciar
      this.estado = 'editando';
      this.cdr.detectChanges();

      this.editor = await PhotoEditorSDKUI.init({
        license: LICENCIA_PESDK,
        container: this.lienzo.nativeElement,
        image: imagen,
        assetBaseUrl: new URL('assets/photoeditorsdk', document.baseURI).href,
        // En el celular, la interfaz "basic" (barra abajo); en pantallas grandes, la "advanced"
        layout: window.innerWidth < 768 ? 'basic' : 'advanced',
        theme: 'dark',
        language: 'en',
        custom: {
          languages: { en: TEXTOS_ES },
          themes: {
            // Colores de la paleta de FitHábitos
            dark: {
              background: '#2f0147',
              foreground: '#fbf5f6',
              primary: '#e2c2c6',
              focusOutlineColor: '#e2c2c6',
              canvas: { background: '#2f0147' },
              mainCanvasActionBar: { background: '#2f0147' },
              toolbar: { background: '#480863', activeBackground: '#610f7f' },
              toolControlBar: { background: '#480863' },
            },
          },
        },
        displayResizeWarning: false,
        displayCloseWarning: true,
        export: {
          image: {
            exportType: ExportFormat.DATA_URL,
            format: ImageFormat.JPEG,
            quality: 0.92,
            enableDownload: false,
          },
        },
      });

      // 3) "Guardar foto" dentro del editor
      this.editor.on(UIEvent.EXPORT, (datos: string | Blob | HTMLImageElement) => this.guardar(datos));
      // "Cerrar" dentro del editor (el SDK ya preguntó si había cambios sin guardar)
      this.editor.on(UIEvent.CLOSE, () => this.cerrarEditor());
    } catch (e: any) {
      await this.cerrarEditor();
      this.actualizar(() => (this.error = 'No se pudo abrir el editor: ' + (e?.message ?? e)));
    }
  }

  /**
   * Desmonta el editor y DESPUÉS vuelve a la pantalla de inicio.
   * El orden importa: si se esconde el contenedor con el editor todavía montado,
   * el SDK se queda con un espacio de 0×0 y marca errores internos.
   * Se hace un instante después porque normalmente se llama desde los propios
   * eventos del SDK (Guardar / Cerrar), cuando todavía está actualizando la pantalla.
   */
  private cerrarEditor(): Promise<void> {
    const editor = this.editor;
    this.editor = null;
    this.cierre = new Promise(listo => setTimeout(() => {
      // dispose() desmonta sin volver a preguntar (el SDK ya preguntó al tocar su "Cerrar")
      try { editor?.dispose(); } catch { /* ya estaba desmontado */ }
      this.actualizar(() => {
        if (this.estado !== 'inicio') this.estado = 'inicio';
      });
      listo();
    }, 0));
    return this.cierre;
  }

  // ==================== 3) GUARDAR EN UNA RUTA LOCAL ====================

  private async guardar(datos: string | Blob | HTMLImageElement) {
    this.actualizar(() => (this.estado = 'guardando'));
    try {
      const dataUrl = await aDataUrl(datos);
      const foto = await this.guardadas.guardar(dataUrl);
      this.actualizar(() => (this.ultima = foto));
      await this.cerrarEditor();
      this.aviso(`Foto guardada en ${foto.rutaLegible}`);
      this.cargarLista();
    } catch (e: any) {
      // Dejamos el editor abierto para no perder la edición
      this.actualizar(() => (this.estado = 'editando'));
      this.aviso(e?.message ?? 'No se pudo guardar la foto.');
    }
  }

  // ==================== FOTOS GUARDADAS ====================

  async cargarLista() {
    this.cargandoLista = true;
    this.cdr.markForCheck();
    try {
      const fotos = await this.guardadas.listar();
      this.actualizar(() => (this.fotos = fotos));
    } finally {
      this.actualizar(() => (this.cargandoLista = false));
    }
  }

  async opciones(f: FotoEditada) {
    const hoja = await this.actionCtrl.create({
      header: f.nombre,
      subHeader: f.rutaLegible,
      buttons: [
        { text: 'Editar otra vez', icon: 'create-outline', handler: () => { this.reeditar(f); } },
        { text: 'Borrar', icon: 'trash-outline', role: 'destructive', handler: () => { this.borrar(f); } },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await hoja.present();
  }

  private async reeditar(f: FotoEditada) {
    try {
      await this.abrirEditor(await this.guardadas.leerComoDataUrl(f));
    } catch {
      this.aviso('No se pudo abrir esa foto.');
    }
  }

  private async borrar(f: FotoEditada) {
    try {
      await this.guardadas.borrar(f);
      if (this.ultima?.ruta === f.ruta && this.ultima.carpeta === f.carpeta) this.ultima = null;
      await this.cargarLista();
    } catch {
      this.aviso('No se pudo borrar.');
    }
  }

  lugar(f: FotoEditada): string {
    return f.rutaLegible.startsWith('Documentos') ? 'Documentos' : 'App';
  }

  tamano(n: number): string {
    return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  fecha(d: Date): string {
    return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  }

  private async aviso(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 3500, position: 'bottom' });
    await t.present();
  }
}

// ==================== AYUDANTES ====================

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    img.src = src;
  });
}

/** Lo que exporta el editor puede venir como texto, Blob o <img>: lo pasamos a data URL. */
async function aDataUrl(d: string | Blob | HTMLImageElement): Promise<string> {
  if (typeof d === 'string') return d;
  if (d instanceof Blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(d);
    });
  }
  const c = document.createElement('canvas');
  c.width = d.naturalWidth;
  c.height = d.naturalHeight;
  c.getContext('2d')!.drawImage(d, 0, 0);
  return c.toDataURL('image/jpeg', 0.92);
}
