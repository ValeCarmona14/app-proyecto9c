import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
// Usamos la versión "lazy" de Ionic en TODA la app, igual que en las páginas
// (login.module.ts e inicio.module.ts). Antes aquí se usaba la versión
// "standalone" y por eso ion-icon, ion-button, ion-toolbar, los modales y
// el menú de cuenta nunca se cargaban: no se veían y no hacían nada.
import { IonicModule, IonicRouteStrategy } from '@ionic/angular/lazy';
import { IonicStorageModule } from '@ionic/storage-angular';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './services/auth.interceptor';
import { loadingInterceptor } from './services/loading.interceptor';
import { apiInterceptor } from './services/api.interceptor';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    IonicModule.forRoot(), // <-- carga TODOS los componentes de Ionic
    AppRoutingModule,
    IonicStorageModule.forRoot(), // <-- inicializa Ionic Storage
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // HttpClient de Angular para la API REST. Los interceptores corren en este orden:
    //  1. authInterceptor    -> agrega el token (si hay) y manda al login si responde 401
    //  2. loadingInterceptor -> muestra el ion-loading mientras dura la petición
    //  3. apiInterceptor     -> arma la URL con la IP guardada, cabeceras y registro de la petición
    provideHttpClient(withInterceptors([authInterceptor, loadingInterceptor, apiInterceptor])),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
