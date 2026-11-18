import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../core/i18n';
import { NegocioTarjeta } from '../core/modelos';
import { etiquetasVisibles } from '../core/servicios';
import { Clave } from '../core/textos';
import { Imagen } from './imagen';

/** Tarjeta de un negocio: foto, nombre, calificación y precio a la vista. */
@Component({
  selector: 'app-tarjeta-negocio',
  imports: [RouterLink, Imagen],
  templateUrl: './tarjeta-negocio.html',
  styleUrl: './tarjeta.scss',
})
export class TarjetaNegocio {
  protected readonly i18n = inject(I18n);
  readonly negocio = input.required<NegocioTarjeta>();
  readonly patrocinado = input(false);
  /** Claves de servicios del filtro activo: sus etiquetas van primero y resaltadas. */
  readonly resaltar = input<readonly string[]>([]);

  protected readonly etiquetas = computed(() => etiquetasVisibles(this.negocio().servicios, this.resaltar()));

  protected readonly precio = computed(() => {
    const n = this.negocio();
    if (n.precioDesde == null) return null;
    const unidad = n.unidadPrecio ? this.i18n.t(('unidad_' + n.unidadPrecio) as Clave) : '';
    return { monto: this.i18n.precio(n.precioDesde, n.moneda), unidad };
  });

  protected readonly calificacion = computed(() => {
    const p = this.negocio().calificacionPromedio;
    return p == null ? null : p.toFixed(1);
  });
}
