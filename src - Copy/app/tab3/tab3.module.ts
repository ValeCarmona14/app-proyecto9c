import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonList,
  IonItem,
  IonLabel,
  IonCheckbox,
  IonInput,
  IonButton,
  IonIcon,
  IonProgressBar,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/angular';

import { Tab3Page } from './tab3.page';
import { Tab3PageRoutingModule } from './tab3-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    Tab3PageRoutingModule,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonCheckbox,
    IonInput,
    IonButton,
    IonIcon,
    IonProgressBar,
    IonGrid,
    IonRow,
    IonCol,
  ],
  declarations: [Tab3Page],
})
export class Tab3PageModule {}
