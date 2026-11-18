import { Routes } from '@angular/router';
import { conSesion } from './core/guardias';
import { Shell } from './layout/shell';

export const routes: Routes = [
  { path: 'ingresar', loadComponent: () => import('./pages/ingresar/ingresar').then((m) => m.Ingresar), title: 'Ingresar · Portal del negocio' },
  { path: 'restablecer-clave', loadComponent: () => import('./pages/ingresar/ingresar').then((m) => m.Ingresar), data: { modo: 'restablecer' }, title: 'Nueva contraseña · Portal del negocio' },
  { path: 'verificar-correo', loadComponent: () => import('./pages/ingresar/ingresar').then((m) => m.Ingresar), data: { modo: 'verificar' }, title: 'Confirmar correo · Portal del negocio' },
  {
    path: '',
    component: Shell,
    canActivate: [conSesion],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'negocios' },
      { path: 'negocios', loadComponent: () => import('./pages/negocios/negocios').then((m) => m.Negocios), title: 'Mis negocios · Portal del negocio' },
      { path: 'negocios/:id', loadComponent: () => import('./pages/resumen/resumen').then((m) => m.Resumen), title: 'Resumen · Portal del negocio' },
      { path: 'negocios/:id/ficha', loadComponent: () => import('./pages/editor/editor').then((m) => m.Editor), title: 'Editar ficha · Portal del negocio' },
      { path: 'negocios/:id/fotos', loadComponent: () => import('./pages/fotos/fotos').then((m) => m.Fotos), title: 'Fotos · Portal del negocio' },
      { path: 'negocios/:id/opciones', loadComponent: () => import('./pages/opciones/opciones').then((m) => m.Opciones), title: 'Menú y opciones · Portal del negocio' },
      { path: 'negocios/:id/promociones', loadComponent: () => import('./pages/promociones/promociones').then((m) => m.Promociones), title: 'Promociones · Portal del negocio' },
      { path: 'negocios/:id/plan', loadComponent: () => import('./pages/plan/plan').then((m) => m.Plan), title: 'Plan y pagos · Portal del negocio' },
      { path: 'negocios/:id/equipo', loadComponent: () => import('./pages/equipo/equipo').then((m) => m.Equipo), title: 'Equipo · Portal del negocio' },
      { path: 'negocios/:id/reporte', loadComponent: () => import('./pages/reporte/reporte').then((m) => m.Reporte), title: 'Reporte mensual · Portal del negocio' },
    ],
  },
  { path: '**', redirectTo: 'negocios' },
];
