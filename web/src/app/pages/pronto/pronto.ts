import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../../core/i18n';
import { Seo } from '../../core/seo';

/** Pantalla provisional de las secciones que ya existen en la API y se arman en las siguientes entregas. */
@Component({
  selector: 'app-pronto',
  imports: [RouterLink],
  template: `
    <div class="contenedor caja">
      <h1>{{ i18n.t('pronto') }}</h1>
      <p>{{ i18n.t('prontoTexto') }}</p>
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
      font-size: clamp(1.6rem, 1.2rem + 2vw, 2.4rem);
    }
  `,
})
export class Pronto implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly seo = inject(Seo);
  ngOnInit(): void {
    this.seo.pagina(this.i18n.t('pronto'), this.i18n.t('prontoTexto'), '', { noIndexar: true });
  }
}
