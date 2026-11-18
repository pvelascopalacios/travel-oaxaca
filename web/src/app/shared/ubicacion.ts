import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

export interface Punto {
  lat: number;
  lng: number;
}

/** Pide la ubicación del visitante solo cuando toca «Cerca de mí». No se guarda en ningún lado. */
@Injectable({ providedIn: 'root' })
export class Ubicacion {
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));

  obtener(): Promise<Punto | null> {
    if (!this.navegador || !('geolocation' in navigator)) return Promise.resolve(null);
    return new Promise((resolver) =>
      navigator.geolocation.getCurrentPosition(
        (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolver(null),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
      ),
    );
  }
}
