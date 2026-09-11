import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import {
  IonicRouteStrategy,
  provideIonicAngular,
  IonApp,
  IonRouterOutlet,
} from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    // Componentes de Ionic que usa app.component.html
    IonApp,
    IonRouterOutlet,
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(), // inicializa Ionic (reemplaza a IonicModule.forRoot)
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
