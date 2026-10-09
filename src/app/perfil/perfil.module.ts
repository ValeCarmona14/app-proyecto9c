import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { PerfilPageRoutingModule } from './perfil-routing.module';
import { PerfilPage } from './perfil.page';
import { CompartidoModule } from '../compartido/compartido.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, PerfilPageRoutingModule, CompartidoModule],
  declarations: [PerfilPage],
})
export class PerfilPageModule {}
