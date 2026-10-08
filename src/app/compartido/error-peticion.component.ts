import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular/lazy';
import { RegistroPeticion } from '../services/peticion.model';

/**
 * Modal de error para las pantallas que consumen APIs.
 * Muestra los mismos datos que el log del login.
 * Al cerrarse regresa un "role": 'reintentar', 'origen' o 'cerrar'.
 */
@Component({
  selector: 'app-error-peticion',
  templateUrl: './error-peticion.component.html',
  styleUrls: ['./error-peticion.component.scss'],
  standalone: false,
})
export class ErrorPeticionComponent {
  @Input() registro: RegistroPeticion | null = null;
  @Input() titulo = 'Error en la petición';
  @Input() puedeReintentar = true;

  constructor(private modalCtrl: ModalController) {}

  cerrar(role: 'reintentar' | 'origen' | 'cerrar' = 'cerrar') {
    this.modalCtrl.dismiss(null, role);
  }
}
