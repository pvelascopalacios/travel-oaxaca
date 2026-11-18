import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../core/i18n';
import { EventoTarjeta } from '../core/modelos';

/** Tarjeta de un evento con el día en grande, como en un calendario. */
@Component({
  selector: 'app-tarjeta-evento',
  imports: [RouterLink],
  template: `
    <a class="tarjeta evento" [routerLink]="['/', i18n.lang(), 'evento', evento().slug]">
      <span class="fecha">
        <strong>{{ dia() }}</strong>
        <span>{{ mes() }}</span>
      </span>
      <div class="cuerpo">
        <h3>{{ evento().nombre }}</h3>
        <p class="categoria">{{ evento().municipioNombre }}</p>
        @if (evento().datos['gratis'] === true) {
          <p class="estado abierto">{{ i18n.t('gratis') }}</p>
        }
      </div>
    </a>
  `,
  styleUrl: './tarjeta.scss',
})
export class TarjetaEvento {
  protected readonly i18n = inject(I18n);
  readonly evento = input.required<EventoTarjeta>();
  protected readonly dia = computed(() => this.i18n.fecha(this.evento().fechaInicio, { day: 'numeric' }));
  protected readonly mes = computed(() => this.i18n.fecha(this.evento().fechaInicio, { month: 'short' }));
}
