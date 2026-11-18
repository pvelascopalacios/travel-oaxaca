import { isPlatformBrowser } from '@angular/common';
import {
  Component, ElementRef, PLATFORM_ID, ViewEncapsulation, afterNextRender, effect, inject, input, output, signal, viewChild, OnDestroy,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { I18n } from '../core/i18n';

export interface Pin {
  id: string;
  slug: string;
  nombre: string;
  lat: number;
  lng: number;
  /** Texto dentro del pin (el precio). Sin texto, se dibuja un punto. */
  etiqueta: string;
}

export interface Zona {
  norte: number;
  sur: number;
  este: number;
  oeste: number;
}

const CENTRO_OAXACA: [number, number] = [17.0654, -96.7236];

/** Mapa de OpenStreetMap con Leaflet. Solo corre en el navegador; en el servidor deja el espacio reservado. */
@Component({
  selector: 'app-mapa',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="mapa-caja">
      <div #lienzo class="mapa-lienzo" role="region" [attr.aria-label]="i18n.t('mapa')"></div>
      @if (movido() && conZona()) {
        <button type="button" class="mapa-zona" (click)="buscarZona()">{{ i18n.t('buscarEnZona') }}</button>
      }
    </div>
  `,
  styleUrl: './mapa.scss',
})
export class Mapa implements OnDestroy {
  protected readonly i18n = inject(I18n);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');

  readonly pines = input<Pin[]>([]);
  /** Puntos sin precio que aparecen al buscar en otra zona. */
  readonly extras = input<Pin[]>([]);
  readonly elegido = input<string | null>(null);
  /** Las fichas no ofrecen «Buscar en esta zona»: el mapa solo muestra su punto o su recorrido. */
  readonly conZona = input(true);
  readonly elegir = output<string>();
  readonly zona = output<Zona>();

  protected readonly movido = signal(false);

  private L: typeof Leaflet | null = null;
  private mapa: Leaflet.Map | null = null;
  private capa: Leaflet.LayerGroup | null = null;
  private ajustando = false;
  private ajustado = false;
  private readonly listo = signal(false);
  private readonly marcas = new Map<string, { marca: Leaflet.Marker; el: HTMLElement }>();

  constructor() {
    afterNextRender(() => void this.iniciar());
    effect(() => {
      // Se vuelve a dibujar cuando cambian los puntos o el elegido.
      const pines = this.pines();
      const extras = this.extras();
      const elegido = this.elegido();
      if (this.listo()) this.dibujar(pines, extras, elegido);
    });
  }

  private async iniciar(): Promise<void> {
    if (!this.navegador) return;
    const modulo = await import('leaflet');
    this.L = ((modulo as unknown as { default?: typeof Leaflet }).default ?? modulo) as typeof Leaflet;
    const L = this.L;
    this.mapa = L.map(this.lienzo().nativeElement, { zoomControl: true, scrollWheelZoom: true }).setView(CENTRO_OAXACA, 8);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(this.mapa);
    this.capa = L.layerGroup().addTo(this.mapa);
    this.mapa.on('moveend', () => {
      if (this.ajustando) {
        this.ajustando = false;
        return;
      }
      this.movido.set(true);
    });
    this.listo.set(true);
  }

  private dibujar(pines: Pin[], extras: Pin[], elegido: string | null): void {
    const L = this.L;
    if (!L || !this.mapa || !this.capa) return;
    this.capa.clearLayers();
    this.marcas.clear();
    const puntos: Leaflet.LatLngTuple[] = [];
    for (const x of extras) {
      const el = document.createElement('span');
      el.className = 'pin punto';
      this.agregar(x, el, 0);
    }
    for (const p of pines) {
      const el = document.createElement('span');
      el.className = 'pin' + (p.etiqueta ? '' : ' punto') + (p.id === elegido ? ' elegido' : '');
      el.textContent = p.etiqueta;
      this.agregar(p, el, p.id === elegido ? 1000 : 500);
      puntos.push([p.lat, p.lng]);
    }
    if (!this.ajustado && puntos.length) {
      this.ajustado = true;
      this.ajustando = true;
      this.mapa.fitBounds(L.latLngBounds(puntos), { padding: [36, 36], maxZoom: 14 });
    }
  }

  private agregar(p: Pin, el: HTMLElement, z: number): void {
    const L = this.L!;
    const icono = L.divIcon({ html: el, className: 'pin-caja', iconSize: [0, 0] });
    const marca = L.marker([p.lat, p.lng], { icon: icono, zIndexOffset: z, title: p.nombre, keyboard: true });
    marca.on('click', () => this.elegir.emit(p.id));
    marca.addTo(this.capa!);
    this.marcas.set(p.id, { marca, el });
  }

  /** Cuando cambian los filtros hay que volver a encuadrar el mapa. */
  reencuadrar(): void {
    this.ajustado = false;
    this.movido.set(false);
    if (this.listo()) this.dibujar(this.pines(), this.extras(), this.elegido());
  }

  protected buscarZona(): void {
    const b = this.mapa?.getBounds();
    if (!b) return;
    this.movido.set(false);
    this.zona.emit({ norte: b.getNorth(), sur: b.getSouth(), este: b.getEast(), oeste: b.getWest() });
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
    this.mapa = null;
  }
}
