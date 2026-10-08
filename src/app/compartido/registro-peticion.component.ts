import { ChangeDetectorRef, Component, Input } from '@angular/core';
import { RegistroPeticion } from '../services/peticion.model';

/**
 * Muestra el detalle de una petición: IP destino, protocolo, puertos,
 * cabeceras, payload y la respuesta del servidor.
 * Se usa en el login (log de error), en la modal de error y en Origen de datos.
 */
@Component({
  selector: 'app-registro-peticion',
  templateUrl: './registro-peticion.component.html',
  styleUrls: ['./registro-peticion.component.scss'],
  standalone: false,
})
export class RegistroPeticionComponent {
  @Input() registro: RegistroPeticion | null = null;
  @Input() titulo = 'Log de la petición';
  copiado = false;

  constructor(private cdr: ChangeDetectorRef) {}

  json(valor: any): string {
    if (valor === null || valor === undefined || valor === '') return '(vacío)';
    if (typeof valor === 'string') return valor;
    return JSON.stringify(valor, null, 2);
  }

  get hora(): string {
    return this.registro ? new Date(this.registro.fecha).toLocaleString('es-MX') : '';
  }

  /** Copia todo el registro como JSON (útil para pegarlo y revisarlo). */
  async copiar() {
    if (!this.registro) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.registro, null, 2));
      this.copiado = true;
      this.cdr.markForCheck();
      setTimeout(() => { this.copiado = false; this.cdr.markForCheck(); }, 1800);
    } catch { /* el portapapeles puede no estar disponible */ }
  }
}
