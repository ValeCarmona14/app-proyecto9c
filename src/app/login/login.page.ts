import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { DatosService } from '../services/datos.service';
import { ServidorService } from '../services/servidor.service';
import { registrarIconos } from '../services/iconos';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  modo: 'login' | 'registro' = 'login';
  /** IP:puerto de XAMPP donde están las APIs (se guarda en Preferences). */
  servidor = '';
  nombre = '';
  email = '';
  password = '';
  password2 = '';
  verPass = false;
  cargando = false;
  error = '';
  sacudir = false;
  enLinea = navigator.onLine;

  constructor(
    private auth: AuthService,
    private datos: DatosService,
    private servidorSrv: ServidorService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {
    registrarIconos();
  }

  ngOnInit() {
    window.addEventListener('online', () => { this.enLinea = true; this.refrescar(); });
    window.addEventListener('offline', () => { this.enLinea = false; this.refrescar(); });
    this.alEntrar();
    this.cargarServidor();
  }

  /** Pone en el campo la IP que se guardó la última vez. */
  private async cargarServidor() {
    this.servidor = await this.servidorSrv.obtener();
    this.refrescar();
  }

  // Se llama al crear la página y cada vez que vuelves a ella
  ionViewWillEnter() {
    this.alEntrar();
  }

  private alEntrar() {
    // Si ya hay sesión guardada, no hay que volver a iniciar sesión
    if (this.auth.estaLogueado()) {
      this.router.navigateByUrl('/inicio', { replaceUrl: true });
      return;
    }
    // Viene del botón "Crear cuenta nueva"
    if (this.route.snapshot.queryParamMap.get('modo') === 'registro') {
      this.modo = 'registro';
    }
  }

  cambiarModo(m: 'login' | 'registro') {
    this.modo = m;
    this.error = '';
  }

  async enviar() {
    this.error = '';
    const email = this.email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(email)) return this.fallo('Escribe un correo válido, por ejemplo ana@correo.com.');
    if (this.password.length < 6) return this.fallo('La contraseña debe tener al menos 6 caracteres.');
    if (this.modo === 'registro') {
      if (!this.nombre.trim()) return this.fallo('Escribe tu nombre.');
      if (this.password !== this.password2) return this.fallo('Las contraseñas no coinciden.');
    }

    // Guardamos la IP antes de llamar a la API, así todas las pantallas la usan
    if (!(await this.servidorSrv.guardar(this.servidor))) {
      return this.fallo('Escribe la IP del servidor, por ejemplo 10.0.2.2:8080.');
    }
    this.servidor = await this.servidorSrv.obtener();

    this.cargando = true;
    try {
      if (this.modo === 'registro') {
        const reg = await this.auth.registrar({ nombre: this.nombre.trim(), email, password: this.password });
        if (!reg.ok) return this.fallo(reg.error || 'No se pudo crear la cuenta.');
      }
      // Tras registrarse, inicia sesión solo
      const res = await this.auth.login(email, this.password);
      if (!res.ok) return this.fallo(res.error || 'Correo o contraseña incorrectos.');

      this.limpiar();
      this.datos.sincronizar();
      this.router.navigateByUrl('/inicio', { replaceUrl: true });
    } finally {
      this.cargando = false;
      this.refrescar();
    }
  }

  /** Avisa a Angular que repinte la pantalla (necesario en Angular sin zone.js). */
  private refrescar() {
    this.cdr.markForCheck();
  }

  private fallo(msg: string) {
    this.error = msg;
    this.sacudir = false;
    this.refrescar();
    requestAnimationFrame(() => { this.sacudir = true; this.refrescar(); });
    setTimeout(() => { this.sacudir = false; this.refrescar(); }, 450);
  }

  private limpiar() {
    this.nombre = this.password = this.password2 = '';
    this.error = '';
  }
}
