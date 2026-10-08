import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { InicioPageRoutingModule } from './inicio-routing.module';
import { InicioPage } from './inicio.page';
import { DiaComponent } from './dia/dia.component';
import { CompartidoModule } from '../compartido/compartido.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, InicioPageRoutingModule, CompartidoModule],
  declarations: [InicioPage, DiaComponent],
})
export class InicioPageModule {}
