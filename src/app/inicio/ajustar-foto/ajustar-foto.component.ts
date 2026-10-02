import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { ModalController } from '@ionic/angular/lazy';
import { registrarIconos } from '../../services/iconos';

type Modo = 'mover' | 'nw' | 'ne' | 'sw' | 'se';
interface Rect { x: number; y: number; w: number; h: number; }

/**
 * Editor de recorte: muestra la foto completa con un recuadro encima.
 * El recuadro tiene la forma de tu pantalla; lo mueves y lo haces más
 * grande o más chico desde las esquinas. Lo de adentro se vuelve el fondo.
 */
@Component({
  selector: 'app-ajustar-foto',
  templateUrl: './ajustar-foto.component.html',
  styleUrls: ['./ajustar-foto.component.scss'],
  standalone: false,
})
export class AjustarFotoComponent implements AfterViewInit, OnDestroy {
  @Input() imagen = '';
  /** Ancho / alto de la pantalla donde se verá el fondo. */
  @Input() aspectoNum = 16 / 9;
  /** Qué tanto se ve la foto (0.1 a 0.8). */
  @Input() visibilidad = 0.3;

  @ViewChild('zona') zona!: ElementRef<HTMLDivElement>;

  lista = false;
  readonly casillas = Array.from({ length: 35 });

  /** Recorte en píxeles REALES de la foto. */
  c: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** Escala: píxeles en pantalla por cada píxel de la foto. */
  s = 1;
  dispW = 0;
  dispH = 0;
  fondoTam = '';
  fondoPos = '';

  private img = new Image();
  private IW = 0;   // ancho real de la foto
  private IH = 0;   // alto real de la foto
  private modo: Modo | null = null;
  private inicio = { px: 0, py: 0, c: { x: 0, y: 0, w: 0, h: 0 } as Rect };
  private observador?: ResizeObserver;

  constructor(private modalCtrl: ModalController, private cdr: ChangeDetectorRef) {
    registrarIconos();
  }

  ngAfterViewInit() {
    this.img.onload = () => {
      this.IW = this.img.naturalWidth;
      this.IH = this.img.naturalHeight;
      this.reiniciar();
      this.lista = true;
      this.medir();
    };
    this.img.src = this.imagen;

    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(this.zona.nativeElement);
  }

  ngOnDestroy() {
    this.observador?.disconnect();
  }

  /** Ajusta el tamaño de la foto en pantalla al espacio disponible. */
  private medir() {
    if (!this.IW) return;
    const anchoZona = this.zona.nativeElement.clientWidth - 32;
    const altoMax = window.innerHeight * 0.5;
    this.s = Math.min(anchoZona / this.IW, altoMax / this.IH);
    this.dispW = this.IW * this.s;
    this.dispH = this.IH * this.s;
    this.cdr.markForCheck();
  }

  /** El recuadro más grande posible, centrado. */
  reiniciar() {
    let w = this.IW;
    let h = w / this.aspectoNum;
    if (h > this.IH) { h = this.IH; w = h * this.aspectoNum; }
    this.c = { x: (this.IW - w) / 2, y: (this.IH - h) / 2, w, h };
    this.actualizarVista();
  }

  // ==================== ARRASTRAR ====================

  tocar(e: PointerEvent) {
    const modo = (e.target as HTMLElement).dataset['modo'] as Modo | undefined;
    if (!modo) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.modo = modo;
    this.inicio = { px: e.clientX, py: e.clientY, c: { ...this.c } };
  }

  mover(e: PointerEvent) {
    if (!this.modo) return;
    // Cuánto se movió el dedo, convertido a píxeles de la foto
    const dx = (e.clientX - this.inicio.px) / this.s;
    const dy = (e.clientY - this.inicio.py) / this.s;
    const o = this.inicio.c;

    if (this.modo === 'mover') {
      this.c = {
        ...o,
        x: this.limitar(o.x + dx, 0, this.IW - o.w),
        y: this.limitar(o.y + dy, 0, this.IH - o.h),
      };
    } else {
      this.redimensionar(this.modo, o, dx, dy);
    }
    this.actualizarVista();
  }

  soltar(_: PointerEvent) {
    this.modo = null;
  }

  /** Jalar una esquina: la esquina contraria se queda fija y se respeta la forma. */
  private redimensionar(esq: Exclude<Modo, 'mover'>, o: Rect, dx: number, dy: number) {
    const A = this.aspectoNum;
    const derecha = esq === 'ne' || esq === 'se';
    const abajo = esq === 'sw' || esq === 'se';

    // Esquina fija (la contraria a la que jalas)
    const fx = derecha ? o.x : o.x + o.w;
    const fy = abajo ? o.y : o.y + o.h;

    // Nuevo ancho según hacia dónde jalaste (toma el movimiento más grande)
    const porX = o.w + (derecha ? dx : -dx);
    const porY = (o.h + (abajo ? dy : -dy)) * A;
    let w = Math.max(porX, porY);

    // Límites: no más chico que 15% de la foto, ni salirse de ella
    const maxW = Math.min(
      derecha ? this.IW - fx : fx,
      (abajo ? this.IH - fy : fy) * A,
    );
    w = this.limitar(w, Math.min(maxW, this.IW * 0.15), maxW);
    const h = w / A;

    this.c = { x: derecha ? fx : fx - w, y: abajo ? fy : fy - h, w, h };
  }

  /** Rueda del mouse: agranda o achica el recuadro desde su centro. */
  rueda(e: WheelEvent) {
    e.preventDefault();
    const f = e.deltaY < 0 ? 0.94 : 1 / 0.94;
    const A = this.aspectoNum;
    const cx = this.c.x + this.c.w / 2;
    const cy = this.c.y + this.c.h / 2;
    const maxW = Math.min(this.IW, this.IH * A);
    const w = this.limitar(this.c.w * f, this.IW * 0.15, maxW);
    const h = w / A;
    this.c = {
      w, h,
      x: this.limitar(cx - w / 2, 0, this.IW - w),
      y: this.limitar(cy - h / 2, 0, this.IH - h),
    };
    this.actualizarVista();
  }

  private limitar(v: number, min: number, max: number) {
    return Math.max(min, Math.min(max, v));
  }

  /** Calcula la vista previa pequeña con lo que hay dentro del recuadro. */
  private actualizarVista() {
    const c = this.c;
    this.fondoTam = `${(this.IW / c.w) * 100}% auto`;
    const px = this.IW - c.w > 0.5 ? (c.x / (this.IW - c.w)) * 100 : 50;
    const py = this.IH - c.h > 0.5 ? (c.y / (this.IH - c.h)) * 100 : 50;
    this.fondoPos = `${px}% ${py}%`;
    this.cdr.markForCheck();
  }

  // ==================== RESULTADO ====================

  cancelar() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  /** Recorta exactamente lo que está dentro del recuadro. */
  usar() {
    const largo = 1600;
    const A = this.aspectoNum;
    const outW = A >= 1 ? largo : Math.round(largo * A);
    const outH = A >= 1 ? Math.round(largo / A) : largo;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    canvas.getContext('2d')!.drawImage(this.img, this.c.x, this.c.y, this.c.w, this.c.h, 0, 0, outW, outH);

    this.modalCtrl.dismiss(
      { dataUrl: canvas.toDataURL('image/jpeg', 0.75), visibilidad: this.visibilidad },
      'ok',
    );
  }
}
