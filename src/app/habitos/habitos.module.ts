import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { HabitosPageRoutingModule } from './habitos-routing.module';
import { HabitosPage } from './habitos.page';
import { HabitoFormComponent } from './habito-form/habito-form.component';
import { CompartidoModule } from '../compartido/compartido.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, HabitosPageRoutingModule, CompartidoModule],
  declarations: [HabitosPage, HabitoFormComponent],
})
export class HabitosPageModule {}
