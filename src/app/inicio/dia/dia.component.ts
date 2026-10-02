import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular/lazy';
import { Subscription } from 'rxjs';
import { DatosService, Diario, Ejercicio, Habito } from '../../services/datos.service';
import { Frase, fraseDelDia } from '../../services/frases';
import { aISO, nuevoId } from '../../services/utiles';
import { registrarIconos } from '../../services/iconos';

type Vista = 'tarjetas' | 'habitos' | 'entreno' | 'diario' | 'frase';

/** Hoja que se abre al tocar un día del calendario. */
@Component({
  selector: 'app-dia',
  templateUrl: './dia.component.html',
  styleUrls: ['./dia.component.scss'],
  standalone: false,
})
export class DiaComponent implements OnInit, OnDestroy {
  @Input() fecha = aISO(new Date());

  vista: Vista = 'tarjetas';
  diaSemana = '';
  diaNumero = 0;
  mesNombre = '';
  esHoy = false;

  habitos: Habito[] = [];
  hechos: Record<string, boolean> = {};
  editando = false;
  nuevoHabito = '';

  ejercicios: Ejercicio[] = [];
  nuevoEj = { nombre: '', series: 3, reps: 10, kg: 0 };

  diario: Diario = { texto: '', animo: '' };
  guardandoDiario = false;
  readonly animos = [
    { emoji: '😄', nombre: 'Genial' },
    { emoji: '🙂', nombre: 'Bien' },
    { emoji: '😐', nombre: 'Normal' },
    { emoji: '😴', nombre: 'Cansado' },
    { emoji: '😣', nombre: 'Difícil' },
  ];

  frase!: Frase;
  private desplazamientoFrase = 0;
  animarFrase = false;

  private sub?: Subscription;
  private tDiario: any;

  constructor(private datos: DatosService, private modalCtrl: ModalController, private cdr: ChangeDetectorRef) {
    registrarIconos();
  }

  ngOnInit() {
    const [a, m, d] = this.fecha.split('-').map(Number);
    const f = new Date(a, m - 1, d);
    this.diaSemana = f.toLocaleDateString('es-MX', { weekday: 'long' });
    this.diaNumero = d;
    this.mesNombre = f.toLocaleDateString('es-MX', { month: 'long' });
    this.esHoy = this.fecha === aISO(new Date());
    this.frase = fraseDelDia(this.fecha);
    this.cargar();
    // Si llegan cambios del servidor mientras está abierto, refresca
    // (excepto el diario si lo estás escribiendo, para no borrarte texto)
    this.sub = this.datos.cambios$.subscribe(() => { this.cargar(this.vista === 'diario'); this.cdr.markForCheck(); });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    if (this.tDiario) {
      clearTimeout(this.tDiario);
      this.datos.guardarDiario(this.fecha, this.diario);
    }
  }

  private cargar(conservarDiario = false) {
    this.habitos = this.datos.habitos();
    this.hechos = { ...this.datos.habitosHechos(this.fecha) };
    this.ejercicios = this.datos.entreno(this.fecha);
    if (!conservarDiario) this.diario = { ...this.datos.diario(this.fecha) };
  }

  // ---------- navegación dentro de la hoja ----------
  async abrir(v: Vista) {
    this.vista = v;
    const modal = await this.modalCtrl.getTop();
    modal?.setCurrentBreakpoint(1);
  }
  volver() { this.vista = 'tarjetas'; this.editando = false; }
  cerrar() { this.modalCtrl.dismiss(); }
  porId = (_: number, x: { id: string }) => x.id;

  // ---------- resúmenes para las tarjetas ----------
  get hechosCount() { return this.habitos.filter(h => this.hechos[h.id]).length; }
  get porcentaje() { return this.habitos.length ? Math.round((this.hechosCount / this.habitos.length) * 100) : 0; }
  get volumen() { return this.ejercicios.reduce((t, e) => t + e.series * e.reps * e.kg, 0); }
  get palabras() { return this.diario.texto.trim() ? this.diario.texto.trim().split(/\s+/).length : 0; }

  // ---------- hábitos ----------
  alternarHabito(id: string) {
    this.hechos[id] = !this.hechos[id];
    this.datos.guardarHabitosHechos(this.fecha, this.hechos);
  }
  agregarHabito() {
    const nombre = this.nuevoHabito.trim();
    if (!nombre) return;
    this.habitos = [...this.habitos, { id: nuevoId(), nombre, icono: 'ellipse-outline' }];
    this.datos.guardarHabitos(this.habitos);
    this.nuevoHabito = '';
  }
  borrarHabito(id: string) {
    this.habitos = this.habitos.filter(h => h.id !== id);
    this.datos.guardarHabitos(this.habitos);
  }

  // ---------- entrenamiento ----------
  agregarEjercicio() {
    const n = this.nuevoEj;
    if (!n.nombre.trim()) return;
    this.ejercicios = [...this.ejercicios, {
      id: nuevoId(),
      nombre: n.nombre.trim(),
      series: Math.max(1, Number(n.series) || 1),
      reps: Math.max(1, Number(n.reps) || 1),
      kg: Math.max(0, Number(n.kg) || 0),
    }];
    this.datos.guardarEntreno(this.fecha, this.ejercicios);
    // Deja series/reps/kg para cargar rápido la siguiente
    this.nuevoEj = { ...n, nombre: '' };
  }
  borrarEjercicio(id: string) {
    this.ejercicios = this.ejercicios.filter(e => e.id !== id);
    this.datos.guardarEntreno(this.fecha, this.ejercicios);
  }

  // ---------- diario ----------
  elegirAnimo(emoji: string) {
    this.diario.animo = this.diario.animo === emoji ? '' : emoji;
    this.datos.guardarDiario(this.fecha, this.diario);
  }
  escribirDiario() {
    this.guardandoDiario = true;
    clearTimeout(this.tDiario);
    this.tDiario = setTimeout(() => {
      this.datos.guardarDiario(this.fecha, { ...this.diario });
      this.guardandoDiario = false;
      this.tDiario = null;
      this.cdr.markForCheck();
    }, 600);
  }

  // ---------- frase ----------
  otraFrase() {
    this.desplazamientoFrase++;
    this.frase = fraseDelDia(this.fecha, this.desplazamientoFrase);
    this.animarFrase = false;
    requestAnimationFrame(() => { this.animarFrase = true; this.cdr.markForCheck(); });
  }
}
