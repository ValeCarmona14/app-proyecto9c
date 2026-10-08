import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  // Al abrir la app vamos al calendario; si no hay sesión, el guard manda al login
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  {
    path: 'login',
    loadChildren: () => import('./login/login.module').then(m => m.LoginPageModule),
  },
  {
    path: 'inicio',
    canActivate: [AuthGuard],
    loadChildren: () => import('./inicio/inicio.module').then(m => m.InicioPageModule),
  },
  // Progreso: las 3 gráficas hechas con D3.js
  {
    path: 'progreso',
    canActivate: [AuthGuard],
    loadChildren: () => import('./progreso/progreso.module').then(m => m.ProgresoPageModule),
  },
  // Origen de datos: se puede abrir desde el login (sin sesión) y desde el inicio
  {
    path: 'origen-datos',
    loadChildren: () => import('./origen-datos/origen-datos.module').then(m => m.OrigenDatosPageModule),
  },
  // Cualquier ruta vieja (como /tabs/tab1) cae al inicio
  { path: '**', redirectTo: 'inicio' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
