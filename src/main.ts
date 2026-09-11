import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

// Cargar los custom elements de Ionic PWA antes de arrancar
defineCustomElements(window);

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err: any) => console.error(err));
