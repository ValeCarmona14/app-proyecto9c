import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { DatosService } from '../services/datos.service';
import { aISO } from '../services/utiles';
import { registrarIconos } from '../services/iconos';
import { DatoBarra } from './graficas/grafica-barras.component';
import { DatoLinea } from './graficas/grafica-lineas.component';
import { DatoDona } from './graficas/grafica-dona.component';

type Medida = 'volumen' | 'series';

/** Colores de la paleta para las rebanadas de la dona (se repiten si hay más hábitos). */
const COLORES = ['#610f7f', '#ab7295', '#2f0147', '#e2c2c6', '#9c528b', '#b9929f', '#480863'];

@Component({
  selector: 'app-progreso',
  templateUrl: './progreso.page.html',
  styleUrls: ['./progreso.page.scss'],
  standalone: false,
})
export class ProgresoPage implements OnInit, OnDestroy {
  readonly DIAS_LARGO = 30;

  // Gráfica 1: barras (últimos 7 días)
  semana: DatoBarra[] = [];
  totalHabitos = 0;
  cumplidosSemana = 0;

  // Gráfica 2: líneas (últimos 30 días)
  medida: Medida = 'volumen';
  entrenos: DatoLinea[] = [];
  diasEntrenados = 0;

  // Gráfica 3: dona (últimos 30 días)
  porHabito: DatoDona[] = [];
  porcentaje = 0;

  private sub?: Subscription;

  constructor(private datos: DatosService, private cdr: ChangeDetectorRef) {
    registrarIconos();
  }

  ngOnInit() {
    // Si llegan datos nuevos del servidor, se recalculan las gráficas
    this.sub = this.datos.cambios$.subscribe(() => this.calcular());
  }

  ionViewWillEnter() {
    this.calcular();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  cambiarMedida(m: any) {
    this.medida = m as Medida;
    this.calcularEntrenos();
  }

  /** Las últimas n fechas, de la más vieja a hoy. */
  private ultimosDias(n: number): Date[] {
    const hoy = new Date();
    return Array.from({ length: n }, (_, i) =>
      new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (n - 1 - i)));
  }

  private calcular() {
    const habitos = this.datos.habitos();
    const ids = new Set(habitos.map(h => h.id));
    this.totalHabitos = habitos.length;
    const hoy = aISO(new Date());

    // ---- 1) Barras: hábitos cumplidos por día ----
    this.semana = this.ultimosDias(7).map(d => {
      const fecha = aISO(d);
      const hechos = this.datos.habitosHechos(fecha);
      return {
        etiqueta: d.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', ''),
        valor: Object.keys(hechos).filter(id => hechos[id] && ids.has(id)).length,
        destacado: fecha === hoy,
      };
    });
    this.cumplidosSemana = this.semana.reduce((s, d) => s + d.valor, 0);

    // ---- 3) Dona: cuántos días cumpliste cada hábito ----
    const cuenta = new Map<string, number>(habitos.map(h => [h.id, 0]));
    for (const d of this.ultimosDias(this.DIAS_LARGO)) {
      const hechos = this.datos.habitosHechos(aISO(d));
      for (const id of Object.keys(hechos)) {
        if (hechos[id] && cuenta.has(id)) cuenta.set(id, cuenta.get(id)! + 1);
      }
    }
    this.porHabito = habitos.map((h, i) => ({
      nombre: h.nombre,
      valor: cuenta.get(h.id)!,
      color: COLORES[i % COLORES.length],
    }));
    const posibles = habitos.length * this.DIAS_LARGO;
    const logrados = this.porHabito.reduce((s, d) => s + d.valor, 0);
    this.porcentaje = posibles ? Math.round((logrados / posibles) * 100) : 0;

    // ---- 2) Líneas: entrenamiento por día ----
    this.calcularEntrenos();
  }

  private calcularEntrenos() {
    this.entrenos = this.ultimosDias(this.DIAS_LARGO).map(d => {
      const lista = this.datos.entreno(aISO(d));
      const valor = this.medida === 'volumen'
        ? lista.reduce((s, e) => s + (e.series || 0) * (e.reps || 0) * (e.kg || 0), 0)
        : lista.reduce((s, e) => s + (e.series || 0), 0);
      return { fecha: d, valor };
    });
    this.diasEntrenados = this.entrenos.filter(e => e.valor > 0).length;
    this.cdr.markForCheck();
  }

  get hayHabitos(): boolean { return this.porHabito.some(d => d.valor > 0); }
  get hayEntrenos(): boolean { return this.diasEntrenados > 0; }
  get unidad(): string { return this.medida === 'volumen' ? 'kg' : 'series'; }
}
