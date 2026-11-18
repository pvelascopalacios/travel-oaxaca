import { InjectionToken } from '@angular/core';

/** Dirección de la API: el mismo dominio del panel (proxy inverso en producción, proxy de desarrollo en `npm start`). */
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => location.origin + '/api/v1',
});
