import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ROLES_PANEL, tieneAlgunRol } from './panel';
import { Sesion } from './sesion';

/** Todo el panel pide sesión; sin ella se manda a ingresar y se vuelve a donde iba. */
export const conSesion: CanActivateFn = (_ruta, estado) => {
  if (inject(Sesion).autenticado()) return true;
  return inject(Router).createUrlTree(['/ingresar'], { queryParams: { volver: estado.url } });
};

/** Solo entran quienes tienen un rol del equipo (admin, editor o ventas). */
export const conRolDelEquipo: CanActivateFn = () => {
  const s = inject(Sesion);
  return tieneAlgunRol(s.usuario()?.roles, ROLES_PANEL) ? true : inject(Router).createUrlTree(['/sin-acceso']);
};

/** La revisión es de admin y editor. Ventas vuelve a su inicio. */
export const conRevision: CanActivateFn = () => {
  const s = inject(Sesion);
  return tieneAlgunRol(s.usuario()?.roles, ['admin', 'editor']) ? true : inject(Router).createUrlTree(['/negocios']);
};

/** Los cobros son de admin y ventas. */
export const conCobros: CanActivateFn = () => {
  const s = inject(Sesion);
  return tieneAlgunRol(s.usuario()?.roles, ['admin', 'ventas']) ? true : inject(Router).createUrlTree(['/negocios']);
};

/** Planes, precios y cupones son solo de administración. */
export const conCatalogo: CanActivateFn = () => {
  const s = inject(Sesion);
  return tieneAlgunRol(s.usuario()?.roles, ['admin']) ? true : inject(Router).createUrlTree(['/negocios']);
};

/** La raíz lleva a «Hoy», la primera pantalla de todos los roles del equipo. */
export const inicioPorRol: CanActivateFn = () => inject(Router).createUrlTree(['/hoy']);

/** Contenido editorial (inicio, lugares, rutas, eventos y localidades): administración y edición. */
export const conContenido: CanActivateFn = () => {
  const s = inject(Sesion);
  return tieneAlgunRol(s.usuario()?.roles, ['admin', 'editor']) ? true : inject(Router).createUrlTree(['/negocios']);
};

/** Moderación de la comunidad: administración y edición (igual que la revisión de fichas). */
export const conModeracion: CanActivateFn = conRevision;

/** Usuarios, roles y solicitudes de privacidad: solo administración. */
export const conAdministracion: CanActivateFn = () => {
  const s = inject(Sesion);
  return tieneAlgunRol(s.usuario()?.roles, ['admin']) ? true : inject(Router).createUrlTree(['/negocios']);
};

/** El embudo de prospectos es de administración y ventas. */
export const conVentas: CanActivateFn = conCobros;
