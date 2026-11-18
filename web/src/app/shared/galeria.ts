import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, HostListener, effect, inject, input, signal, viewChild } from '@angular/core';
import { I18n } from '../core/i18n';
import { Foto } from '../core/modelos';

/** Fotos de una ficha: una grande y hasta cuatro chicas; todas se ven en una vista ampliada. Sin fotos no se dibuja nada. */
@Component({
  selector: 'app-galeria',
  template: `
    @if (fotos().length) {
      <div class="rejilla" [class.una]="fotos().length === 1">
        <button type="button" class="grande" (click)="abrir(0)" [attr.aria-label]="i18n.tf('fotoDe', { i: 1, n: fotos().length })">
          <img [src]="fotos()[0].url" [alt]="fotos()[0].pieTexto || nombre()" fetchpriority="high" decoding="async" />
        </button>
        @for (f of chicas(); track f.url; let i = $index) {
          <button type="button" class="chica" (click)="abrir(i + 1)" [attr.aria-label]="i18n.tf('fotoDe', { i: i + 2, n: fotos().length })">
            <img [src]="f.url" [alt]="f.pieTexto || nombre()" loading="lazy" decoding="async" />
          </button>
        }
        @if (fotos().length > 1) {
          <button type="button" class="ver-todas" (click)="abrir(0)">{{ i18n.tf('galeriaVer', { n: fotos().length }) }}</button>
        }
      </div>
      @if (actual() !== null) {
        <div class="visor" role="dialog" aria-modal="true" [attr.aria-label]="nombre()" (click)="cerrar()">
          <button #cierre type="button" class="cerrar" (click)="cerrar()">{{ i18n.t('galeriaCerrar') }}</button>
          <figure (click)="$event.stopPropagation()">
            <img [src]="fotos()[actual()!].url" [alt]="fotos()[actual()!].pieTexto || nombre()" />
            <figcaption>
              <span>{{ i18n.tf('fotoDe', { i: actual()! + 1, n: fotos().length }) }}</span>
              @if (fotos()[actual()!].pieTexto; as pie) {
                <span class="pie">{{ pie }}</span>
              }
            </figcaption>
          </figure>
          @if (fotos().length > 1) {
            <button type="button" class="nav ant" (click)="mover(-1); $event.stopPropagation()" [attr.aria-label]="i18n.t('galeriaAnterior')">‹</button>
            <button type="button" class="nav sig" (click)="mover(1); $event.stopPropagation()" [attr.aria-label]="i18n.t('galeriaSiguiente')">›</button>
          }
        </div>
      }
    }
  `,
  styleUrl: './galeria.scss',
})
export class Galeria {
  protected readonly i18n = inject(I18n);
  private readonly doc = inject(DOCUMENT);
  readonly fotos = input<Foto[]>([]);
  readonly nombre = input('');
  protected readonly actual = signal<number | null>(null);
  private readonly cierre = viewChild<ElementRef<HTMLButtonElement>>('cierre');
  private devolver: HTMLElement | null = null;

  constructor() {
    effect(() => {
      // Al abrir la vista ampliada el foco pasa al botón de cerrar; al cerrarla vuelve a donde estaba.
      const c = this.cierre();
      if (c) c.nativeElement.focus();
    });
  }

  protected chicas(): Foto[] {
    return this.fotos().slice(1, 5);
  }

  protected abrir(i: number): void {
    this.devolver = this.doc.activeElement as HTMLElement | null;
    this.actual.set(i);
    this.doc.body.style.overflow = 'hidden';
  }

  protected cerrar(): void {
    this.actual.set(null);
    this.doc.body.style.overflow = '';
    this.devolver?.focus();
  }

  protected mover(paso: number): void {
    const n = this.fotos().length;
    const a = this.actual();
    if (a === null || !n) return;
    this.actual.set((a + paso + n) % n);
  }

  @HostListener('document:keydown', ['$event'])
  protected teclas(e: KeyboardEvent): void {
    if (this.actual() === null) return;
    if (e.key === 'Escape') this.cerrar();
    else if (e.key === 'ArrowLeft') this.mover(-1);
    else if (e.key === 'ArrowRight') this.mover(1);
  }
}
