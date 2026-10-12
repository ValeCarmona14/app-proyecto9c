import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular/lazy';
import { Habito, HabitoNuevo } from '../../models/api.models';
import { CATEGORIAS, Categoria, categoria } from '../categorias';

/**
 * Formulario para crear (POST) o editar (PUT) un hábito.
 * Se abre como modal desde HabitosPage y regresa el hábito con role 'guardar'.
 * Valida en la app antes de mandar nada al servidor.
 */
@Component({
  selector: 'app-habito-form',
  templateUrl: './habito-form.component.html',
  styleUrls: ['./habito-form.component.scss'],
  standalone: false,
})
export class HabitoFormComponent implements OnInit {
  /** Si viene, estamos editando. */
  @Input() habito: Habito | null = null;

  readonly categorias = CATEGORIAS;
  readonly colores = ['#610f7f', '#9c528b', '#ab7295', '#3a86ff', '#2a9d8f', '#e76f51', '#480863'];

  form: HabitoNuevo = {
    nombre: '',
    descripcion: '',
    categoria: 'hidratacion',
    metaDiaria: 8,
    unidad: 'vasos',
    icono: 'water-outline',
    color: '#3a86ff',
    activo: true,
  };
  errores: Partial<Record<'nombre' | 'metaDiaria' | 'unidad', string>> = {};

  constructor(private modalCtrl: ModalController) {}

  ngOnInit() {
    if (this.habito) {
      const { id, actualizado, ...resto } = this.habito;
      this.form = { ...resto, descripcion: resto.descripcion ?? '' };
    }
  }

  get editando(): boolean {
    return !!this.habito;
  }

  elegirCategoria(valor: Categoria) {
    const anterior = categoria(this.form.categoria);
    const nueva = categoria(valor);
    this.form.categoria = valor;
    this.form.icono = nueva.icono;
    // Si el usuario no había cambiado la unidad o el color, los sugerimos
    if (!this.form.unidad || this.form.unidad === anterior.unidad) this.form.unidad = nueva.unidad;
    if (this.form.color === anterior.color) this.form.color = nueva.color;
  }

  private validar(): boolean {
    this.errores = {};
    const nombre = this.form.nombre.trim();
    if (!nombre) this.errores.nombre = 'Escribe un nombre.';
    else if (nombre.length > 80) this.errores.nombre = 'Máximo 80 caracteres.';
    const meta = Number(this.form.metaDiaria);
    if (!Number.isInteger(meta) || meta < 1 || meta > 10000) this.errores.metaDiaria = 'Un número entero entre 1 y 10000.';
    if (!this.form.unidad.trim()) this.errores.unidad = 'Ej. vasos, minutos, horas.';
    return Object.keys(this.errores).length === 0;
  }

  guardar() {
    if (!this.validar()) return;
    const datos: HabitoNuevo = {
      ...this.form,
      nombre: this.form.nombre.trim(),
      descripcion: (this.form.descripcion ?? '').trim(),
      unidad: this.form.unidad.trim(),
      metaDiaria: Number(this.form.metaDiaria),
    };
    this.modalCtrl.dismiss(datos, 'guardar');
  }

  cancelar() {
    this.modalCtrl.dismiss(null, 'cancelar');
  }
}
