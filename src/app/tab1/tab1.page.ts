import { NgForm } from '@angular/forms';
import { Contacto, ContactoService } from '../services/contacto.service';
import { Component, OnInit, NgZone } from '@angular/core';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit {
  /** modelo del formulario de alta */
  contacto: Contacto = this.nuevoContacto();

  /** registros existentes */
  lista: Contacto[] = [];

  /** estado de UI */
  cargando = false;
  mensaje = '';
  tipoMensaje: 'exito' | 'error' = 'exito';

  /** modales */
  modalEditar = false;
  modalEliminar = false;
  editModel: Contacto = this.nuevoContacto();
  aEliminar: Contacto | null = null;

    constructor(private contactoService: ContactoService, private zone: NgZone) {}

  ngOnInit(): void {
    this.cargarLista();
  }

  private nuevoContacto(): Contacto {
    return { nombre: '', empresa: '', email: '', telefono: '', mensaje: '' };
  }

  // ==================== LEER (GET) ====================
     async cargarLista(): Promise<void> {
    this.cargando = true;
    try {
      const res = await this.contactoService.listar();
      this.zone.run(() => {
        this.lista = res.ok && res.data ? (res.data as Contacto[]) : [];
        this.cargando = false;
      });
    } catch {
      this.zone.run(() => {
        this.cargando = false;
        this.mostrarMensaje('No se pudo conectar con el servidor.', 'error');
      });
    }
  }
  // ==================== CREAR (POST) ====================
  async enviar(form: NgForm): Promise<void> {
    if (form.invalid) {
      this.mostrarMensaje('Completa los campos obligatorios.', 'error');
      return;
    }
    this.cargando = true;
    try {
      const res = await this.contactoService.crear(this.contacto);
      if (res.ok) {
        this.mostrarMensaje('Registro enviado correctamente.', 'exito');
        this.contacto = this.nuevoContacto();
        form.resetForm();
        await this.cargarLista();
      } else {
        this.mostrarMensaje(res.error || 'No se pudo enviar.', 'error');
      }
    } catch {
      this.mostrarMensaje('No se pudo conectar con el servidor.', 'error');
    } finally {
      this.cargando = false;
    }
  }

  // ==================== EDITAR (PUT) ====================
  abrirEditar(c: Contacto): void {
    this.editModel = { ...c }; // copia para no tocar la lista hasta guardar
    this.modalEditar = true;
  }

  async guardarEdicion(form: NgForm): Promise<void> {
    if (form.invalid || this.editModel.id == null) {
      this.mostrarMensaje('Completa los campos obligatorios.', 'error');
      return;
    }
    this.cargando = true;
    try {
      const res = await this.contactoService.actualizar(
        this.editModel.id,
        this.editModel
      );
      if (res.ok) {
        this.mostrarMensaje('Registro actualizado.', 'exito');
        this.cerrarModales();
        await this.cargarLista();
      } else {
        this.mostrarMensaje(res.error || 'No se pudo actualizar.', 'error');
      }
    } catch {
      this.mostrarMensaje('No se pudo conectar con el servidor.', 'error');
    } finally {
      this.cargando = false;
    }
  }

  // ==================== ELIMINAR (DELETE) ====================
  confirmarEliminar(c: Contacto): void {
    this.aEliminar = c;
    this.modalEliminar = true;
  }

  async eliminar(): Promise<void> {
    if (!this.aEliminar || this.aEliminar.id == null) return;
    this.cargando = true;
    try {
      const res = await this.contactoService.eliminar(this.aEliminar.id);
      if (res.ok) {
        this.mostrarMensaje('Registro eliminado.', 'exito');
        this.cerrarModales();
        await this.cargarLista();
      } else {
        this.mostrarMensaje(res.error || 'No se pudo eliminar.', 'error');
      }
    } catch {
      this.mostrarMensaje('No se pudo conectar con el servidor.', 'error');
    } finally {
      this.cargando = false;
    }
  }

  // ==================== UTILIDADES ====================
  cerrarModales(): void {
    this.modalEditar = false;
    this.modalEliminar = false;
    this.aEliminar = null;
  }

  private mostrarMensaje(texto: string, tipo: 'exito' | 'error'): void {
    this.mensaje = texto;
    this.tipoMensaje = tipo;
    // se oculta solo a los 4 segundos
    setTimeout(() => (this.mensaje = ''), 4000);
  }
}

