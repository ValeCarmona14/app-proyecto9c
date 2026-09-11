import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
} from '@ionic/angular';

import { Tab3Page } from './tab3.page';
import { Tab3PageRoutingModule } from './tab3-routing.module';
import { ExploreContainerComponent } from '../explore-container/explore-container.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    Tab3PageRoutingModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
  ],
  declarations: [Tab3Page, ExploreContainerComponent],
})
export class Tab3PageModule {}
