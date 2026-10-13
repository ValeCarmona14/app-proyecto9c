import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { EditorFotoPage } from './editor-foto.page';

const routes: Routes = [{ path: '', component: EditorFotoPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class EditorFotoPageRoutingModule {}
