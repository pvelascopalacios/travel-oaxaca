import { Component, input } from '@angular/core';

/** Foto de portada o, si no hay, un fondo neutro con la inicial. Nunca deja un hueco. */
@Component({
  selector: 'app-imagen',
  template: `
    @if (url(); as u) {
      <img [src]="u" [alt]="alt()" loading="lazy" decoding="async" />
    } @else {
      <div class="vacia" aria-hidden="true"><span>{{ inicial() }}</span></div>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .vacia {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      background: var(--cantera);
      font: 700 2.4rem var(--fuente-titulo);
      color: var(--noche);
      opacity: 0.55;
    }
  `,
})
export class Imagen {
  readonly url = input<string | null>(null);
  readonly alt = input('');
  readonly texto = input('');
  inicial(): string {
    return (this.texto() || '?').trim().charAt(0).toUpperCase();
  }
}
