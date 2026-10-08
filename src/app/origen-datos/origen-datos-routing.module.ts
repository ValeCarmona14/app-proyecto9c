import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OrigenDatosPage } from './origen-datos.page';

const routes: Routes = [{ path: '', component: OrigenDatosPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrigenDatosPageRoutingModule {}
