import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { OrigenDatosPageRoutingModule } from './origen-datos-routing.module';
import { OrigenDatosPage } from './origen-datos.page';
import { CompartidoModule } from '../compartido/compartido.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, OrigenDatosPageRoutingModule, CompartidoModule],
  declarations: [OrigenDatosPage],
})
export class OrigenDatosPageModule {}
