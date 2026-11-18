import { inject } from '@angular/core';
import { CanMatchFn, RedirectCommand, Router, Routes } from '@angular/router';
import { IDIOMAS } from './core/config';
import { I18n } from './core/i18n';
import { Shell } from './layout/shell';
import { Inicio } from './pages/inicio/inicio';
import { NoEncontrada } from './pages/pronto/no-encontrada';
import { Pronto } from './pages/pronto/pronto';

/** Solo entra si el primer segmento es un idioma válido, y lo fija como idioma activo. */
const idiomaValido: CanMatchFn = (_ruta, segmentos) => {
  const primero = segmentos[0]?.path ?? '';
  if (!(IDIOMAS as readonly string[]).includes(primero)) return false;
  inject(I18n).fijar(primero);
  return true;
};

/** Sin idioma en la dirección (por ejemplo /dormir) se manda al español. */
const sinIdioma: CanMatchFn = (_ruta, segmentos) => {
  const primero = segmentos[0]?.path ?? '';
  if ((IDIOMAS as readonly string[]).includes(primero) || segmentos.length === 0) return false;
  const router = inject(Router);
  const consulta = router.getCurrentNavigation()?.extractedUrl.queryParams ?? {};
  const destino = router.createUrlTree(['/es', ...segmentos.map((s) => s.path)], { queryParams: consulta });
  return new RedirectCommand(destino);
};

// Estas secciones se arman en entregas siguientes (pantallas de negocios en el paso 11).
const secciones = [
  'privacidad', 'terminos',
];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'es' },
  {
    path: ':lang',
    canMatch: [idiomaValido],
    component: Shell,
    children: [
      { path: '', pathMatch: 'full', component: Inicio },
      { path: 'descubrir', loadComponent: () => import('./pages/lista/lista').then((m) => m.Lista), data: { grupo: 'descubrir', ruta: 'descubrir' } },
      { path: 'dormir', loadComponent: () => import('./pages/lista/lista').then((m) => m.Lista), data: { grupo: 'dormir', ruta: 'dormir' } },
      { path: 'comer-y-beber', loadComponent: () => import('./pages/lista/lista').then((m) => m.Lista), data: { grupo: 'comer', ruta: 'comer-y-beber' } },
      { path: 'artesanias', loadComponent: () => import('./pages/lista/lista').then((m) => m.Lista), data: { grupo: 'compras', ruta: 'artesanias' } },
      { path: 'eventos', loadComponent: () => import('./pages/lista/lista').then((m) => m.Lista), data: { grupo: 'descubrir', ver: 'eventos', titulo: 'tituloEventos', ruta: 'eventos' } },
      { path: 'lugares', loadComponent: () => import('./pages/lista/lista').then((m) => m.Lista), data: { grupo: 'descubrir', ver: 'lugares', titulo: 'tituloLugares', ruta: 'lugares' } },
      { path: 'buscar', loadComponent: () => import('./pages/buscar/buscar').then((m) => m.Buscar), },
      { path: 'region/:slug', loadComponent: () => import('./pages/region/region').then((m) => m.Region), },
      { path: 'negocio/:slug', loadComponent: () => import('./pages/negocio/negocio').then((m) => m.Negocio), },
      { path: 'negocio/:slug/resena', loadComponent: () => import('./pages/resenar/resenar').then((m) => m.Resenar), },
      { path: 'ingresar', loadComponent: () => import('./pages/ingresar/ingresar').then((m) => m.Ingresar), },
      { path: 'restablecer-clave', loadComponent: () => import('./pages/ingresar/ingresar').then((m) => m.Ingresar), data: { modo: 'restablecer' } },
      { path: 'verificar-correo', loadComponent: () => import('./pages/ingresar/ingresar').then((m) => m.Ingresar), data: { modo: 'verificar' } },
      { path: 'perfil', loadComponent: () => import('./pages/perfil/perfil').then((m) => m.Perfil), },
      { path: 'listas', loadComponent: () => import('./pages/listas/listas').then((m) => m.Listas), },
      { path: 'listas/:id', loadComponent: () => import('./pages/mi-lista/mi-lista').then((m) => m.MiLista), },
      { path: 'lista/:id', loadComponent: () => import('./pages/lista-publica/lista-publica').then((m) => m.ListaPublica), },
      { path: 'mis-resenas', loadComponent: () => import('./pages/mis-resenas/mis-resenas').then((m) => m.MisResenas), },
      { path: 'guardados', loadComponent: () => import('./pages/guardados/guardados').then((m) => m.Guardados), },
      { path: 'reporte', loadComponent: () => import('./pages/reporte/reporte').then((m) => m.Reporte), },
      { path: 'lugar/:slug', loadComponent: () => import('./pages/lugar/lugar').then((m) => m.Lugar), },
      { path: 'evento/:slug', loadComponent: () => import('./pages/evento/evento').then((m) => m.Evento), },
      { path: 'ruta/:slug', loadComponent: () => import('./pages/ruta/ruta').then((m) => m.Ruta), },
      { path: 'para-negocios', loadComponent: () => import('./pages/para-negocios/para-negocios').then((m) => m.ParaNegocios), },
      { path: 'rutas', loadComponent: () => import('./pages/rutas/rutas').then((m) => m.Rutas), },
      ...secciones.map((path) => ({ path, component: Pronto })),
      { path: '**', component: NoEncontrada },
    ],
  },
  { path: '**', canMatch: [sinIdioma], component: NoEncontrada },
  { path: '**', component: NoEncontrada },
];
