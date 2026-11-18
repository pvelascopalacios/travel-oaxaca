import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { HttpClient, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';
import { routes } from './app.routes';
import { autenticar } from './core/auth.interceptor';
import { CONTACTO_PLANES, SITIO_URL } from './core/config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideHttpClient(withFetch(), withInterceptors([autenticar])),
    // Dirección del sitio público y contacto para planes desde config.json; si no carga, quedan los predeterminados.
    provideAppInitializer(async () => {
      const destino = inject(SITIO_URL);
      const contacto = inject(CONTACTO_PLANES);
      try {
        const c = await firstValueFrom(inject(HttpClient).get<{ sitioUrl?: string; contactoPlanes?: string }>('config.json').pipe(timeout(3000)));
        if (c?.sitioUrl && /^https?:\/\//.test(c.sitioUrl)) destino.valor = c.sitioUrl.replace(/\/$/, '');
        if (typeof c?.contactoPlanes === 'string') contacto.valor = c.contactoPlanes.trim();
      } catch {
        /* se queda con lo predeterminado */
      }
    }),
  ],
};
