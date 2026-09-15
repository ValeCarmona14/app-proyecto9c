import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  add,
  trash,
  barbellOutline,
  flameOutline,
  checkmarkCircle,
  personCircleOutline,
  personAddOutline,
  logOutOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

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
export class Tab3Page {
  /** menú del perfil */
  menuAbierto = false;

  /** fecha de hoy */
  fechaHoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  /** hábitos */
  habitos: Habito[] = [
    { nombre: 'Tomar 2L de agua', hecho: false },
    { nombre: 'Entrenar 45 min', hecho: false },
    { nombre: 'Dormir 8 horas', hecho: false },
  ];
  nuevoHabito = '';

  /** rutina */
  series: Serie[] = [];
  nuevoEjercicio = '';
  nuevoKg: number | null = null;
  nuevoReps: number | null = null;

  constructor(private router: Router, private auth: AuthService) {
    addIcons({
      add,
      trash,
      'barbell-outline': barbellOutline,
      'flame-outline': flameOutline,
      'checkmark-circle': checkmarkCircle,
      'person-circle-outline': personCircleOutline,
      'person-add-outline': personAddOutline,
      'log-out-outline': logOutOutline,
    });
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

  // ==================== HÁBITOS ====================
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
  }
  borrarHabito(i: number): void {
    this.habitos.splice(i, 1);
  }

  // ==================== RUTINA ====================
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
  }
  borrarSerie(i: number): void {
    this.series.splice(i, 1);
  }
}
