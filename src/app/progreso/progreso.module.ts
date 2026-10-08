import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { ProgresoPageRoutingModule } from './progreso-routing.module';
import { ProgresoPage } from './progreso.page';
import { GraficaBarrasComponent } from './graficas/grafica-barras.component';
import { GraficaLineasComponent } from './graficas/grafica-lineas.component';
import { GraficaDonaComponent } from './graficas/grafica-dona.component';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, ProgresoPageRoutingModule],
  declarations: [ProgresoPage, GraficaBarrasComponent, GraficaLineasComponent, GraficaDonaComponent],
})
export class ProgresoPageModule {}
