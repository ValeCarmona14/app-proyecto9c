import { Component, OnInit, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  add,
  trash,
  create,
  barbellOutline,
  flameOutline,
  checkmarkCircle,
  personCircleOutline,
  personAddOutline,
  logOutOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';
import { FitnessStorageService } from '../services/fitness-storage.service';

interface Habito {
  nombre: string;
  hecho: boolean;
}

interface Serie {
  ejercicio: string;
  kg: number;
  reps: number;
}

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page implements OnInit {
  menuAbierto = false;

  fechaHoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  habitos: Habito[] = [];
  nuevoHabito = '';

  series: Serie[] = [];
  nuevoEjercicio = '';
  nuevoKg: number | null = null;
  nuevoReps: number | null = null;

  // ----- modales de edición -----
  editHabitoIndex: number | null = null;
  editHabitoNombre = '';

  editSerieIndex: number | null = null;
  editSerie: Serie = { ejercicio: '', kg: 0, reps: 0 };

  constructor(
    private router: Router,
    private auth: AuthService,
    private almacen: FitnessStorageService,
    private zone: NgZone
  ) {
    addIcons({
      add,
      trash,
      create,
      'barbell-outline': barbellOutline,
      'flame-outline': flameOutline,
      'checkmark-circle': checkmarkCircle,
      'person-circle-outline': personCircleOutline,
      'person-add-outline': personAddOutline,
      'log-out-outline': logOutOutline,
    });
  }

  // ==================== CARGA INICIAL (CONSULTA) ====================
  async ngOnInit(): Promise<void> {
    const habitos = await this.almacen.get<Habito[]>('habitos', [
      { nombre: 'Tomar 2L de agua', hecho: false },
      { nombre: 'Entrenar 45 min', hecho: false },
      { nombre: 'Dormir 8 horas', hecho: false },
    ]);
    const series = await this.almacen.get<Serie[]>('series', []);
    this.zone.run(() => {
      this.habitos = habitos;
      this.series = series;
    });
  }

  private guardarHabitos(): void {
    this.almacen.set('habitos', this.habitos);
  }
  private guardarSeries(): void {
    this.almacen.set('series', this.series);
  }

  // ==================== MENÚ PERFIL ====================
  toggleMenu(): void {
    this.menuAbierto = !this.menuAbierto;
  }
  cerrarMenu(): void {
    this.menuAbierto = false;
  }
  irCrearCuenta(): void {
    this.cerrarMenu();
    this.router.navigateByUrl('/tabs/tab1');
  }
  cerrarSesion(): void {
    this.cerrarMenu();
    this.auth.cerrarSesion();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  // ==================== HÁBITOS (CRUD) ====================
  get completados(): number {
    return this.habitos.filter((h) => h.hecho).length;
  }
  get progreso(): number {
    if (this.habitos.length === 0) return 0;
    return this.completados / this.habitos.length;
  }

  agregarHabito(): void {
    const nombre = this.nuevoHabito.trim();
    if (!nombre) return;
    this.habitos.push({ nombre, hecho: false });
    this.nuevoHabito = '';
    this.guardarHabitos();
  }

  /** al marcar/desmarcar el check se guarda */
  toggleHabito(): void {
    this.guardarHabitos();
  }

  borrarHabito(i: number): void {
    this.habitos.splice(i, 1);
    this.guardarHabitos();
  }

  abrirEditarHabito(i: number): void {
    this.editHabitoIndex = i;
    this.editHabitoNombre = this.habitos[i].nombre;
  }
  guardarEdicionHabito(): void {
    const nombre = this.editHabitoNombre.trim();
    if (this.editHabitoIndex === null || !nombre) return;
    this.habitos[this.editHabitoIndex].nombre = nombre;
    this.guardarHabitos();
    this.cerrarModales();
  }

  // ==================== RUTINA (CRUD) ====================
  get volumenTotal(): number {
    return this.series.reduce((total, s) => total + s.kg * s.reps, 0);
  }

  agregarSerie(): void {
    const ejercicio = this.nuevoEjercicio.trim();
    const kg = Number(this.nuevoKg);
    const reps = Number(this.nuevoReps);
    if (!ejercicio || !kg || !reps) return;
    this.series.push({ ejercicio, kg, reps });
    this.nuevoEjercicio = '';
    this.nuevoKg = null;
    this.nuevoReps = null;
    this.guardarSeries();
  }

  borrarSerie(i: number): void {
    this.series.splice(i, 1);
    this.guardarSeries();
  }

  abrirEditarSerie(i: number): void {
    this.editSerieIndex = i;
    this.editSerie = { ...this.series[i] };
  }
  guardarEdicionSerie(): void {
    const ejercicio = this.editSerie.ejercicio.trim();
    const kg = Number(this.editSerie.kg);
    const reps = Number(this.editSerie.reps);
    if (this.editSerieIndex === null || !ejercicio || !kg || !reps) return;
    this.series[this.editSerieIndex] = { ejercicio, kg, reps };
    this.guardarSeries();
    this.cerrarModales();
  }

  // ==================== UTIL ====================
  cerrarModales(): void {
    this.editHabitoIndex = null;
    this.editSerieIndex = null;
  }
}
