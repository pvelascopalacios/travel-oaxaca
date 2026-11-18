import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_URL } from './config';
import { Sesion } from './sesion';

/** Rutas de la API que piden sesión: lo que es de la persona (/mi/…) y todo lo de un negocio (/negocios/{id}…). */
const PRIVADA = /\/api\/v1\/(mi\/|negocios\/[0-9a-f-]{36}(\/|\?|$))/i;

/** Agrega el token de acceso solo a las rutas privadas de nuestra API. Un 401 cierra la sesión local. */
export const autenticar: HttpInterceptorFn = (req, next) => {
  const base = inject(API_URL);
  if (!req.url.startsWith(base) || !PRIVADA.test(req.url)) return next(req);
  const sesion = inject(Sesion);
  return from(sesion.token()).pipe(
    switchMap((token) => next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req)),
    catchError((e) => {
      if (e instanceof HttpErrorResponse && e.status === 401) sesion.cerrarLocal();
      return throwError(() => e);
    }),
  );
};
