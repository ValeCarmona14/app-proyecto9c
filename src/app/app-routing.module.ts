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
  // Mi perfil: editar datos del usuario + foto con su metadata (exifr)
  {
    path: 'perfil',
    canActivate: [AuthGuard],
    loadChildren: () => import('./perfil/perfil.module').then(m => m.PerfilPageModule),
  },
  // Mis hábitos: CRUD contra la API REST (GET, POST, PUT, PATCH, DELETE)
  {
    path: 'habitos',
    canActivate: [AuthGuard],
    loadChildren: () => import('./habitos/habitos.module').then(m => m.HabitosPageModule),
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
