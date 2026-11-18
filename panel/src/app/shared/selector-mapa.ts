import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, output, signal, viewChild, ViewEncapsulation } from '@angular/core';
import type * as Leaflet from 'leaflet';

const CENTRO_OAXACA: [number, number] = [17.0654, -96.7236];

/** Mapa donde se marca el negocio: un toque pone el pin y también se puede arrastrar. Entrega latitud y longitud. */
@Component({
  selector: 'app-selector-mapa',
  encapsulation: ViewEncapsulation.None,
  template: `<div #lienzo class="selector-mapa" role="region" aria-label="Mapa para marcar tu negocio"></div>`,
  styleUrl: './selector-mapa.scss',
})
export class SelectorMapa implements OnDestroy {
  /** Punto actual (o null si todavía no hay). */
  readonly latitud = input<number | null>(null);
  readonly longitud = input<number | null>(null);
  /** Para centrar el mapa cuando aún no hay punto (el municipio elegido). */
  readonly centroLat = input<number | null>(null);
  readonly centroLng = input<number | null>(null);
  readonly deshabilitado = input(false);
  readonly elegido = output<{ latitud: number; longitud: number }>();

  private readonly lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');
  private readonly listo = signal(false);
  private L: typeof Leaflet | null = null;
  private mapa: Leaflet.Map | null = null;
  private marca: Leaflet.Marker | null = null;
  private centrado = false;

  constructor() {
    afterNextRender(() => void this.iniciar());
    effect(() => {
      const lat = this.latitud();
      const lng = this.longitud();
      const cLat = this.centroLat();
      const cLng = this.centroLng();
      if (this.listo()) this.mostrar(lat, lng, cLat, cLng);
    });
  }

  private async iniciar(): Promise<void> {
    const modulo = await import('leaflet');
    const L = ((modulo as unknown as { default?: typeof Leaflet }).default ?? modulo) as typeof Leaflet;
    this.L = L;
    this.mapa = L.map(this.lienzo().nativeElement, { zoomControl: true, scrollWheelZoom: false }).setView(CENTRO_OAXACA, 8);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(this.mapa);
    this.mapa.on('click', (e: Leaflet.LeafletMouseEvent) => {
      if (!this.deshabilitado()) this.elegido.emit({ latitud: e.latlng.lat, longitud: e.latlng.lng });
    });
    this.listo.set(true);
  }

  private mostrar(lat: number | null, lng: number | null, cLat: number | null, cLng: number | null): void {
    const L = this.L;
    const mapa = this.mapa;
    if (!L || !mapa) return;
    if (lat !== null && lng !== null && isFinite(lat) && isFinite(lng)) {
      if (!this.marca) {
        this.marca = L.marker([lat, lng], {
          draggable: !this.deshabilitado(),
          icon: L.divIcon({ className: 'selector-pin-caja', html: '<span class="selector-pin"></span>', iconSize: [30, 30], iconAnchor: [15, 30] }),
        }).addTo(mapa);
        this.marca.on('dragend', () => {
          const p = this.marca!.getLatLng();
          this.elegido.emit({ latitud: p.lat, longitud: p.lng });
        });
      } else {
        this.marca.setLatLng([lat, lng]);
      }
      if (!this.centrado || !mapa.getBounds().contains([lat, lng])) {
        mapa.setView([lat, lng], Math.max(mapa.getZoom(), 15));
        this.centrado = true;
      }
    } else {
      this.marca?.remove();
      this.marca = null;
      this.centrado = false;
      if (cLat !== null && cLng !== null) mapa.setView([cLat, cLng], 13);
    }
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
    this.mapa = null;
  }
}
