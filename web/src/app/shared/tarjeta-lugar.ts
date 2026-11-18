import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../core/i18n';
import { LugarTarjeta } from '../core/modelos';
import { Imagen } from './imagen';

/** Tarjeta de un lugar o atractivo con foto grande. */
@Component({
  selector: 'app-tarjeta-lugar',
  imports: [RouterLink, Imagen],
  template: `
    <a class="tarjeta" [routerLink]="['/', i18n.lang(), 'lugar', lugar().slug]">
      <div class="foto">
        <app-imagen [url]="lugar().portadaUrl" [alt]="lugar().nombre" [texto]="lugar().nombre" />
      </div>
      <div class="cuerpo">
        <p class="categoria">{{ i18n.tDinamico('tipo', lugar().tipo) }} · {{ lugar().municipioNombre }}</p>
        <h3>{{ lugar().nombre }}</h3>
        @if (lugar().datos['entrada'] === 'gratis') {
          <p class="estado abierto">{{ i18n.t('gratis') }}</p>
        }
      </div>
    </a>
  `,
  styleUrl: './tarjeta.scss',
})
export class TarjetaLugar {
  protected readonly i18n = inject(I18n);
  readonly lugar = input.required<LugarTarjeta>();
}
