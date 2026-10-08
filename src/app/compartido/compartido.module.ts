import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular/lazy';
import { RegistroPeticionComponent } from './registro-peticion.component';
import { ErrorPeticionComponent } from './error-peticion.component';

/** Componentes que usan varias pantallas (login, inicio, origen de datos). */
@NgModule({
  imports: [CommonModule, IonicModule],
  declarations: [RegistroPeticionComponent, ErrorPeticionComponent],
  exports: [RegistroPeticionComponent, ErrorPeticionComponent],
})
export class CompartidoModule {}
