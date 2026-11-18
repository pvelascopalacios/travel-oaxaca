import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Favoritos } from '../core/favoritos';
import { I18n } from '../core/i18n';
import { TipoFavorito } from '../core/modelos';
import { Sesion } from '../core/sesion';

/** Botón de guardar. Sin sesión lleva a ingresar y vuelve a la misma ficha. */
@Component({
  selector: 'app-guardar',
  template: `
    <button type="button" class="boton secundario" [class.activo]="activo()" [attr.aria-pressed]="activo()" (click)="tocar()">
      <span aria-hidden="true">{{ activo() ? '♥' : '♡' }}</span>
      {{ activo() ? i18n.t('guardado') : i18n.t('guardar') }}
    </button>
    @if (fallo()) {
      <p class="error" role="alert">{{ i18n.t('errorGuardar') }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .boton {
      width: 100%;
    }
    .activo {
      background: var(--grana);
      color: #fff;
    }
    .error {
      margin: 6px 0 0;
      color: var(--grana);
      font-size: 0.84rem;
    }
  `,
})
export class Guardar {
  protected readonly i18n = inject(I18n);
  private readonly sesion = inject(Sesion);
  private readonly favoritos = inject(Favoritos);
  private readonly router = inject(Router);
  readonly tipo = input.required<TipoFavorito>();
  readonly elementoId = input.required<string>();
  protected readonly fallo = signal(false);

  protected activo(): boolean {
    return this.favoritos.esta(this.tipo(), this.elementoId());
  }

  protected tocar(): void {
    this.fallo.set(false);
    if (!this.sesion.autenticado()) {
      void this.router.navigate(['/', this.i18n.lang(), 'ingresar'], { queryParams: { volver: this.router.url.split('#')[0] } });
      return;
    }
    this.favoritos.alternar(this.tipo(), this.elementoId(), () => this.fallo.set(true));
  }
}
