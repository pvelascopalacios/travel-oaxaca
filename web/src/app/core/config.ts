import { InjectionToken } from '@angular/core';

/** Dirección de la API. En el navegador es la del mismo dominio de la web (proxy inverso o proxy de desarrollo). */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  // Con dirección completa (no relativa) para que el navegador reuse lo que ya descargó el servidor.
  factory: () => (typeof location !== 'undefined' ? location.origin : '') + '/api/v1',
});

/** Dirección pública de la web, para enlaces canónicos y hreflang. */
export const SITE_URL = new InjectionToken<string>('SITE_URL', {
  providedIn: 'root',
  factory: () => (typeof location !== 'undefined' ? location.origin : 'http://localhost:4000'),
});

/**
 * Dirección del portal del negocio, a donde mandan los botones de «Para negocios».
 * En desarrollo es localhost:4300. En producción CAMBIA `PORTAL_PRODUCCION` por el dominio real de tu portal
 * (o provee este token con otro valor al arrancar la app).
 */
export const PORTAL_PRODUCCION = 'https://portal.traveloaxaca.mx';
export const PORTAL_URL = new InjectionToken<string>('PORTAL_URL', {
  providedIn: 'root',
  factory: () =>
    typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:4300' : PORTAL_PRODUCCION,
});

export const IDIOMAS = ['es', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];
