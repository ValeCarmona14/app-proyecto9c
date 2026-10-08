import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular/lazy';
import { LoginPageRoutingModule } from './login-routing.module';
import { LoginPage } from './login.page';
import { CompartidoModule } from '../compartido/compartido.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, LoginPageRoutingModule, CompartidoModule],
  declarations: [LoginPage],
})
export class LoginPageModule {}
