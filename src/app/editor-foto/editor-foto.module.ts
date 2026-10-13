import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular/lazy';
import { EditorFotoPageRoutingModule } from './editor-foto-routing.module';
import { EditorFotoPage } from './editor-foto.page';

@NgModule({
  imports: [CommonModule, IonicModule, EditorFotoPageRoutingModule],
  declarations: [EditorFotoPage],
})
export class EditorFotoPageModule {}
