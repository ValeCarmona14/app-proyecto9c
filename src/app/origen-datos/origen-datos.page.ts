import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/lazy';
import { Subscription } from 'rxjs';
import { ServidorService } from '../services/servidor.service';
import { HttpService } from '../services/http.service';
import { AuthService } from '../services/auth.service';
import { Conexion, PeticionError, RegistroPeticion } from '../services/peticion.model';
import { registrarIconos } from '../services/iconos';

/**
 * Pantalla "Origen de datos": lee y edita el JSON con la conexión
 * (protocolo, IP, puerto de la API y puerto de la BD) y muestra
 * la última petición que hizo la app.
 */
@Component({
  selector: 'app-origen-datos',
  templateUrl: './origen-datos.page.html',
  styleUrls: ['./origen-datos.page.scss'],
  standalone: false,
})
export class OrigenDatosPage implements OnInit, OnDestroy {
  conexion: Conexion = { protocolo: 'http', ip: '', puertoApi: 8080, puertoBd: 3307 };
  jsonTexto = '';
  errorForm = '';
  errorJson = '';
  ultima: RegistroPeticion | null = null;
  probando = false;
  private sub?: Subscription;

  constructor(
    private origen: ServidorService,
    private http: HttpService,
    private auth: AuthService,
    private toastCtrl: ToastController,
    private location: Location,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {
    registrarIconos();
  }

  ngOnInit() {
    // Cada vez que cambia el JSON (aquí o en otra pantalla) refrescamos todo
    this.sub = this.origen.cambios$.subscribe(d => {
      if (!d) return;
      this.conexion = { ...d.conexion };
      this.ultima = d.ultimaPeticion;
      this.jsonTexto = JSON.stringify(d, null, 2);
      this.cdr.markForCheck();
    });
    this.origen.leer();
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  get urlBase(): string {
    return ServidorService.urlBase(this.conexion);
  }

  async guardar() {
    this.errorForm = (await this.origen.guardarConexion(this.conexion)) ?? '';
    this.cdr.markForCheck();
    if (!this.errorForm) this.aviso('Conexión guardada.');
  }

  async guardarJson() {
    this.errorJson = (await this.origen.guardarJson(this.jsonTexto)) ?? '';
    this.cdr.markForCheck();
    if (!this.errorJson) this.aviso('JSON guardado.');
  }

  async restablecer() {
    await this.origen.restablecer();
    this.errorForm = this.errorJson = '';
    this.aviso('Se restablecieron los valores por defecto.');
  }

  /**
   * Guarda y hace una petición GET a login.php para ver si el servidor responde.
   * Cualquier respuesta HTTP (aunque sea 400 o 405) significa que sí hay conexión.
   */
  async probar() {
    await this.guardar();
    if (this.errorForm) return;
    this.probando = true;
    this.cdr.markForCheck();
    try {
      await this.http.peticion('get', `${this.auth.CARPETA_API}/login.php`);
      this.aviso('¡El servidor respondió! La conexión funciona.');
    } catch (e) {
      const r = e instanceof PeticionError ? e.registro : null;
      this.aviso(r?.estadoHttp
        ? `El servidor sí responde (HTTP ${r.estadoHttp}). Revisa el detalle abajo.`
        : 'No hubo respuesta del servidor. Revisa el detalle abajo.');
    } finally {
      this.probando = false;
      this.cdr.markForCheck();
    }
  }

  volver() {
    if (window.history.length > 1) this.location.back();
    else this.router.navigateByUrl('/inicio');
  }

  private async aviso(msg: string) {
    const t = await this.toastCtrl.create({ message: msg, duration: 2500, position: 'bottom', color: 'dark' });
    await t.present();
  }
}
