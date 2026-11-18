import { HTTP_TRANSFER_CACHE_ORIGIN_MAP } from '@angular/common/http';
import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { API_URL, SITE_URL } from './core/config';
import { serverRoutes } from './app.routes.server';

/**
 * En el servidor la API se llama con dirección completa (API_URL) y la web se identifica con SITE_URL
 * para los enlaces canónicos. Ambos vienen del entorno del proceso.
 */
const apiUrl = process.env['API_URL'] ?? 'http://127.0.0.1:8081/api/v1';
const siteUrl = process.env['SITE_URL'] ?? 'http://localhost:4000';

const serverConfig: ApplicationConfig = {
  providers: [
    // La API se pide con su dirección real en el servidor y por el dominio de la web en el navegador;
    // este mapa hace que el navegador reuse lo ya descargado en lugar de pedirlo otra vez.
    { provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP, useValue: { [new URL(apiUrl).origin]: new URL(siteUrl).origin } },
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: API_URL, useValue: apiUrl },
    { provide: SITE_URL, useValue: siteUrl },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
