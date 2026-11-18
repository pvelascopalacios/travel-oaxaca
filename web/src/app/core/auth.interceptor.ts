import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { API_URL } from './config';
import { Sesion } from './sesion';

/** Rutas de la API a las que se les agrega la sesión: lo de la persona (/mi/…), los resultados de su negocio y lecturas/reportes públicos. */
const PRIVADA = new RegExp(
  '/api/v1/(mi/|negocios/[0-9a-f-]{36}/' +
    // Lecturas públicas que, con sesión, marcan «mío» y «ya reaccioné»; y los reportes, que pedimos con cuenta.
    '|publico/(reportes/|(lugares|rutas|eventos|articulos)/[^/?]+/comentarios|negocios/[^/?]+/resenas))',
  'i',
);

/** Agrega el token de acceso solo a las rutas privadas de nuestra API. */
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
