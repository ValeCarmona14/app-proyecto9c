import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent } from '@ionic/angular';

import { LoginPage } from './login.page';
import { LoginPageRoutingModule } from './login-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, LoginPageRoutingModule, IonContent],
  declarations: [LoginPage],
})
export class LoginPageModule {}
