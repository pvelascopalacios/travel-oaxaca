import { InjectionToken } from '@angular/core';

/** Dirección de la API: el mismo dominio del portal (proxy inverso en producción, proxy de desarrollo en `npm start`). */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => location.origin + '/api/v1',
});

/** Dirección del sitio público (términos, privacidad, «ver en el sitio»). Sale de `config.json`, así se cambia sin recompilar. */
export const SITIO_URL = new InjectionToken<{ valor: string }>('SITIO_URL', {
  providedIn: 'root',
  factory: () => ({ valor: 'http://localhost:4200' }),
});

/** Cómo contactar al equipo para cambiar de plan (WhatsApp, enlace o texto). Sale de `config.json` (`contactoPlanes`); vacío = solo «Escríbenos». */
export const CONTACTO_PLANES = new InjectionToken<{ valor: string }>('CONTACTO_PLANES', {
  providedIn: 'root',
  factory: () => ({ valor: '' }),
});
