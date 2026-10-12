import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HabitosPage } from './habitos.page';

const routes: Routes = [{ path: '', component: HabitosPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HabitosPageRoutingModule {}
