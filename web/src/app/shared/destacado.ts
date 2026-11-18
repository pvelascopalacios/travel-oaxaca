import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../core/i18n';

export interface Diapositiva {
  id: string;
  etiqueta: string;
  titulo: string;
  texto: string;
  foto: string;
  credito?: string;
  boton: string;
  ruta: string[];
  queryParams?: Record<string, string>;
}

const CADA_MS = 6500;

/** Tarjeta grande que rota entre lo destacado. Se detiene al pasar el mouse, al enfocar, con el botón y si el visitante pidió menos movimiento. */
@Component({
  selector: 'app-destacado',
  imports: [RouterLink],
  template: `
    @if (actual(); as d) {
      <section class="destacado" [attr.aria-label]="i18n.t('destacadoEtiqueta')" (mouseenter)="encima.set(true)" (mouseleave)="encima.set(false)" (focusin)="encima.set(true)" (focusout)="encima.set(false)">
        <a class="foto" [routerLink]="['/', i18n.lang(), ...d.ruta]" [queryParams]="d.queryParams" tabindex="-1" aria-hidden="true">
          <img [src]="d.foto" alt="" [attr.loading]="indice() === 0 ? 'eager' : 'lazy'" decoding="async" [attr.fetchpriority]="indice() === 0 ? 'high' : null" />
          @if (d.credito) {
            <span class="credito">{{ d.credito }}</span>
          }
        </a>
        <div class="texto" [attr.aria-live]="rotando() ? 'off' : 'polite'">
          <p class="etiqueta">{{ d.etiqueta }}</p>
          <h2>{{ d.titulo }}</h2>
          @if (d.texto) {
            <p class="parrafo">{{ d.texto }}</p>
          }
          <a class="boton" [routerLink]="['/', i18n.lang(), ...d.ruta]" [queryParams]="d.queryParams">{{ d.boton }}</a>
        </div>
        @if (slides().length > 1) {
          <div class="controles">
            <button type="button" class="pausa" (click)="manual.set(!manual())" [attr.aria-label]="manual() ? i18n.t('reanudar') : i18n.t('pausar')">
              {{ manual() ? '▶' : '❚❚' }}
            </button>
            @for (s of slides(); track s.id; let i = $index) {
              <button type="button" class="punto" [class.activo]="i === indice()" [attr.aria-label]="i18n.tf('irTarjeta', { n: i + 1 })" [attr.aria-current]="i === indice() ? 'true' : null" (click)="ir(i)"></button>
            }
          </div>
        }
      </section>
    }
  `,
  styleUrl: './destacado.scss',
})
export class Destacado {
  protected readonly i18n = inject(I18n);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  readonly slides = input<Diapositiva[]>([]);

  protected readonly indice = signal(0);
  protected readonly manual = signal(false);
  protected readonly encima = signal(false);
  private readonly sinMovimiento = signal(false);
  protected readonly rotando = computed(() => !this.manual() && !this.encima() && !this.sinMovimiento() && this.slides().length > 1);
  protected readonly actual = computed(() => this.slides()[this.indice() % Math.max(this.slides().length, 1)] ?? null);

  constructor() {
    const destruir = inject(DestroyRef);
    afterNextRender(() => {
      if (!this.navegador) return;
      this.sinMovimiento.set(matchMedia('(prefers-reduced-motion: reduce)').matches);
      const t = setInterval(() => {
        if (this.rotando()) this.indice.update((i) => (i + 1) % this.slides().length);
      }, CADA_MS);
      destruir.onDestroy(() => clearInterval(t));
    });
  }

  protected ir(i: number): void {
    this.indice.set(i);
  }
}
