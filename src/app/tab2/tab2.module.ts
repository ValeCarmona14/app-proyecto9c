import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonGrid,
  IonRow,
  IonCol,
  IonFab,
  IonFabButton,
  IonIcon,
} from '@ionic/angular';

import { Tab2Page } from './tab2.page';
import { Tab2PageRoutingModule } from './tab2-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    Tab2PageRoutingModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonFab,
    IonFabButton,
    IonIcon,
  ],
  declarations: [Tab2Page],
})
export class Tab2PageModule {}
