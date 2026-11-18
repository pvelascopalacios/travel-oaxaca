import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Sesion } from './sesion';

/** Todo el portal pide sesión; sin ella se manda a ingresar y se vuelve a donde iba. */
export const conSesion: CanActivateFn = (_ruta, estado) => {
  if (inject(Sesion).autenticado()) return true;
  return inject(Router).createUrlTree(['/ingresar'], { queryParams: { volver: estado.url } });
};
