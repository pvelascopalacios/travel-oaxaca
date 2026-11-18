import { Component, OnInit, RESPONSE_INIT, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../../core/i18n';
import { Seo } from '../../core/seo';

/** Página 404. En el servidor responde con código 404 para que los buscadores no la indexen. */
@Component({
  selector: 'app-no-encontrada',
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
      font-size: clamp(1.6rem, 1.2rem + 2vw, 2.4rem);
    }
  `,
})
export class NoEncontrada implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly seo = inject(Seo);
  private readonly respuesta = inject(RESPONSE_INIT, { optional: true });
  ngOnInit(): void {
    this.seo.pagina(this.i18n.t('noEncontrada'), this.i18n.t('noEncontradaTexto'), '', { noIndexar: true });
    if (this.respuesta) this.respuesta.status = 404;
  }
}
