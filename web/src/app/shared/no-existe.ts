import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../core/i18n';

/** Aviso de 404 dentro de una ficha. La página que lo usa fija el código 404 y el noindex. */
@Component({
  selector: 'app-no-existe',
  imports: [RouterLink],
  template: `
    <div class="contenedor caja">
      <h1>{{ i18n.t('noEncontrada') }}</h1>
      <p>{{ i18n.t('noEncontradaTexto') }}</p>
      <a class="boton" [routerLink]="['/', i18n.lang()]">{{ i18n.t('volverInicio') }}</a>
    </div>
  `,
  styles: `
    .caja {
      display: grid;
      gap: 14px;
      justify-items: start;
      padding-block: 64px;
    }
    h1 {
      margin: 0;
      font: 800 clamp(1.6rem, 1.2rem + 2vw, 2.4rem) var(--fuente-titulo);
    }
    p {
      margin: 0;
    }
  `,
})
export class NoExiste {
  protected readonly i18n = inject(I18n);
}
