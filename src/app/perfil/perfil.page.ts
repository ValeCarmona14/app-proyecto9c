import { ChangeDetectorRef, Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ActionSheetController, ModalController, ToastController } from '@ionic/angular/lazy';
import { AuthService } from '../services/auth.service';
import { PerfilService, DatosPerfil } from '../services/perfil.service';
import { DatoMeta, FotoPerfil, FotoPerfilService } from '../services/foto-perfil.service';
import { RegistroPeticion } from '../services/peticion.model';
import { ErrorPeticionComponent } from '../compartido/error-peticion.component';
import { registrarIconos } from '../services/iconos';

const VACIO: DatosPerfil = { email: '', fname: '', lname: '', phone: '', address: '', twitter: '', facebook: '', gplus: '' };

/**
 * Pantalla "Mi perfil":
 *  - edita los datos del usuario (tab1_api/perfil.php)
 *  - foto de perfil hospedada en el teléfono
 *  - muestra la metadata de esa foto leída con exifr
 */
@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: false,
})
export class PerfilPage {
  datos: DatosPerfil = { ...VACIO };
  passActual = '';
  passNueva = '';
  passNueva2 = '';
  verPass = false;

  /** La foto que se ve en pantalla (guardada o recién elegida). */
  foto: FotoPerfil | null = null;
  /** 'nueva' o 'quitar' mientras no toques Guardar. */
  cambioFoto: 'nueva' | 'quitar' | null = null;
  principales: DatoMeta[] = [];
  todos: { clave: string; valor: string }[] = [];
  gps: { lat: number; lon: number } | null = null;
  verTodo = false;

  cargando = false;
  guardando = false;
  sinServidor = false;
  error = '';

  constructor(
    private auth: AuthService,
    private perfil: PerfilService,
    private fotos: FotoPerfilService,
    private actionCtrl: ActionSheetController,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private location: Location,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    registrarIconos();
  }

  async ionViewWillEnter() {
    this.error = '';
    this.passActual = this.passNueva = this.passNueva2 = '';
    this.cambioFoto = null;
    // 1) Lo que ya está en el teléfono, para que la pantalla aparezca al instante
    this.llenar(this.auth.getUsuario());
    this.mostrarFoto(await this.fotos.cargar(this.uid));
    // 2) Los datos frescos del servidor
    this.cargando = true;
    this.cdr.markForCheck();
    const r = await this.perfil.obtener();
    this.sinServidor = !r.ok;
    if (r.ok && r.usuario) {
      this.llenar(r.usuario);
      await this.auth.actualizarCuentaLocal(r.usuario);
    }
    this.cargando = false;
    this.cdr.markForCheck();
  }

  private get uid(): string {
    return this.auth.getUsuarioId() ?? 'local';
  }

  private llenar(u: any) {
    if (!u) return;
    for (const k of Object.keys(VACIO) as (keyof DatosPerfil)[]) {
      this.datos[k] = u[k] ?? (k === 'fname' ? u.nombre ?? '' : '');
    }
  }

  get nombreCompleto(): string {
    return [this.datos.fname, this.datos.lname].filter(Boolean).join(' ') || 'Sin nombre';
  }

  get iniciales(): string {
    const base = [this.datos.fname, this.datos.lname].filter(Boolean).join(' ') || this.datos.email;
    return base.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  volver() {
    this.location.back();
  }

  // ==================== FOTO ====================

  async cambiarFoto() {
    const hoja = await this.actionCtrl.create({
      header: 'Foto de perfil',
      buttons: [
        { text: 'Tomar foto', icon: 'camera-outline', handler: () => { this.elegir('camara'); } },
        { text: 'Elegir de la galería', icon: 'images-outline', handler: () => { this.elegir('galeria'); } },
        ...(this.foto
          ? [{ text: 'Quitar foto', icon: 'trash-outline', role: 'destructive', handler: () => { this.quitarFoto(); } }]
          : []),
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await hoja.present();
  }

  private async elegir(origen: 'camara' | 'galeria') {
    try {
      const foto = origen === 'camara' ? await this.fotos.tomarFoto() : await this.fotos.elegirDeGaleria();
      this.mostrarFoto(foto);
      this.cambioFoto = 'nueva';
      this.cdr.markForCheck();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (!/cancel/i.test(msg)) this.aviso('No se pudo abrir la imagen: ' + msg);
    }
  }

  private quitarFoto() {
    this.mostrarFoto(null);
    this.cambioFoto = 'quitar';
    this.cdr.markForCheck();
  }

  private mostrarFoto(foto: FotoPerfil | null) {
    this.foto = foto;
    this.principales = foto ? this.fotos.principales(foto) : [];
    this.todos = foto ? this.fotos.todos(foto) : [];
    this.gps = foto ? this.fotos.gps(foto) : null;
    this.verTodo = false;
  }

  get urlMapa(): string {
    return this.gps ? `https://www.google.com/maps?q=${this.gps.lat},${this.gps.lon}` : '';
  }

  // ==================== GUARDAR ====================

  private validar(): string {
    if (!/^\S+@\S+\.\S+$/.test(this.datos.email.trim())) return 'Escribe un correo válido.';
    if (this.passNueva || this.passNueva2 || this.passActual) {
      if (!this.passActual) return 'Para cambiar la contraseña escribe primero la actual.';
      if (this.passNueva.length < 6) return 'La contraseña nueva debe tener mínimo 6 caracteres.';
      if (this.passNueva !== this.passNueva2) return 'Las contraseñas nuevas no coinciden.';
    }
    return '';
  }

  async guardar() {
    this.error = this.validar();
    if (this.error) return;
    this.guardando = true;
    this.cdr.markForCheck();

    try {
      // 1) La foto se hospeda en el teléfono
      if (this.cambioFoto === 'nueva' && this.foto) {
        this.foto = await this.fotos.guardar(this.uid, this.foto);
      } else if (this.cambioFoto === 'quitar') {
        await this.fotos.borrar(this.uid);
      }
      this.cambioFoto = null;

      // 2) Los datos (y el nombre + metadata de la foto) se mandan al API
      const r = await this.perfil.actualizar({
        ...this.datos,
        email: this.datos.email.trim().toLowerCase(),
        ...(this.passNueva ? { password_actual: this.passActual, password_nueva: this.passNueva } : {}),
        foto: this.foto?.archivo ?? null,
        foto_meta: this.foto ? this.fotos.resumen(this.foto) : null,
      });

      if (r.ok) {
        if (r.usuario) this.llenar(r.usuario);
        this.passActual = this.passNueva = this.passNueva2 = '';
        this.sinServidor = false;
        this.aviso(r.aviso ? `Perfil guardado. ${r.aviso}` : '¡Perfil guardado!');
      } else if (r.registro && !r.registro.exito) {
        this.error = 'Tu foto quedó guardada en el teléfono, pero los datos no se pudieron subir.';
        this.abrirError(r.registro);
      } else {
        this.error = r.error ?? 'No se pudo guardar.';
      }
    } catch (e: any) {
      this.error = 'No se pudo guardar la foto en el teléfono: ' + (e?.message ?? e);
    } finally {
      this.guardando = false;
      this.cdr.markForCheck();
    }
  }

  private async abrirError(registro: RegistroPeticion) {
    const modal = await this.modalCtrl.create({
      component: ErrorPeticionComponent,
      componentProps: { registro, titulo: 'No se pudo guardar el perfil', puedeReintentar: true },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'reintentar') this.guardar();
    else if (role === 'origen') this.router.navigateByUrl('/origen-datos');
  }

  private async aviso(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2600, position: 'bottom' });
    await t.present();
  }
}
