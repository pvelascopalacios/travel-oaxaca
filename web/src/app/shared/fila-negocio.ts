import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18n } from '../core/i18n';
import { NegocioTarjeta } from '../core/modelos';
import { etiquetasVisibles } from '../core/servicios';
import { Clave } from '../core/textos';
import { Imagen } from './imagen';

/** Negocio en fila: foto chica a la izquierda y los datos que ayudan a decidir. Para listas y para el mapa. */
@Component({
  selector: 'app-fila-negocio',
  imports: [RouterLink, Imagen],
  template: `
    <a class="fila" [class.elegida]="elegida()" [routerLink]="['/', i18n.lang(), 'negocio', negocio().slug]">
      <span class="foto"><app-imagen [url]="negocio().portadaUrl" [alt]="negocio().nombre" [texto]="negocio().nombre" /></span>
      <span class="datos">
        <span class="categoria">{{ negocio().categoriaNombre }} · {{ negocio().municipioNombre }}</span>
        <strong class="nombre">{{ negocio().nombre }}</strong>
        <span class="linea">
          @if (calificacion(); as c) {
            <span><span class="estrella" aria-hidden="true">★</span>&nbsp;<b>{{ c }}</b>&nbsp;<span class="suave">({{ negocio().totalResenas }})</span></span>
          } @else {
            <span class="suave">{{ i18n.t('sinResenas') }}</span>
          }
          @if (simbolos(); as s) {
            <span class="simbolos" [attr.aria-label]="i18n.t(etiquetaPrecio())">{{ s }}</span>
          }
          @if (precio(); as p) {
            <span>{{ i18n.t('desde') }} <b>{{ p.monto }}</b>&nbsp;<span class="suave">{{ p.unidad }}</span></span>
          }
          @if (negocio().abiertoAhora != null) {
            <span class="estado" [class.abierto]="negocio().abiertoAhora">
              {{ negocio().abiertoAhora ? i18n.t('abiertoAhora') : i18n.t('cerradoAhora') }}
            </span>
          }
          @if (distancia(); as d) {
            <span class="suave">{{ d }}</span>
          }
        </span>
        @if (negocio().descripcionCorta) {
          <span class="descripcion">{{ negocio().descripcionCorta }}</span>
        }
        @if (etiquetas().length) {
          <span class="servicios" role="list" [attr.aria-label]="i18n.t('servicios')">
            @for (e of etiquetas(); track e.clave) {
              <span role="listitem" [class.resaltada]="e.resaltada">{{ e.nombre }}</span>
            }
          </span>
        }
      </span>
      @if (negocio().verificado) {
        <span class="verificado" [attr.title]="i18n.t('verificado')">✓ {{ i18n.t('verificado') }}</span>
      }
    </a>
  `,
  styles: `
    .servicios { display: flex; flex-wrap: nowrap; gap: 6px; overflow: hidden; margin-top: 2px; }
    .servicios span { flex: 0 1 auto; min-width: 0; padding: 1px 9px; border: 1px solid var(--linea); border-radius: 999px; background: var(--cantera); color: var(--tinta); font-size: 0.74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .servicios .resaltada { border-color: var(--grana); background: color-mix(in srgb, var(--grana) 10%, var(--papel)); color: var(--grana); font-weight: 600; }
    :host {
      display: block;
    }
    .fila {
      position: relative;
      display: grid;
      grid-template-columns: 112px minmax(0, 1fr);
      gap: 14px;
      align-items: stretch;
      background: var(--papel);
      border-radius: var(--radio);
      overflow: hidden;
      text-decoration: none;
      box-shadow: var(--sombra);
      transition: box-shadow 0.15s ease;
      outline: 2px solid transparent;
      &:hover {
        box-shadow: var(--sombra-fuerte);
      }
      &.elegida {
        outline-color: var(--grana);
      }
    }
    .foto {
      display: block;
      min-height: 108px;
      background: var(--cantera);
    }
    .datos {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 12px 14px 12px 0;
      min-width: 0;
    }
    .categoria,
    .suave,
    .descripcion {
      color: var(--tinta-suave);
      font-size: 0.84rem;
    }
    .descripcion {
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .nombre {
      font: 700 1.05rem/1.2 var(--fuente-titulo);
      overflow-wrap: anywhere;
    }
    .linea {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2px 12px;
      font-size: 0.92rem;
    }
    .estrella {
      color: var(--ocre);
    }
    .simbolos {
      font-weight: 600;
    }
    .estado {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--tinta-suave);
      &.abierto {
        color: var(--sierra);
      }
    }
    .verificado {
      position: absolute;
      top: 8px;
      right: 10px;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--sierra);
    }
    @media (max-width: 520px) {
      .fila {
        grid-template-columns: 92px minmax(0, 1fr);
        gap: 10px;
      }
      .verificado {
        display: none;
      }
    }
  `,
})
export class FilaNegocio {
  protected readonly i18n = inject(I18n);
  readonly negocio = input.required<NegocioTarjeta>();
  readonly elegida = input(false);
  /** Claves de servicios del filtro activo: sus etiquetas van primero y resaltadas. */
  readonly resaltar = input<readonly string[]>([]);
  protected readonly etiquetas = computed(() => etiquetasVisibles(this.negocio().servicios, this.resaltar()));

  protected readonly calificacion = computed(() => {
    const p = this.negocio().calificacionPromedio;
    return p == null ? null : p.toFixed(1);
  });
  protected readonly simbolos = computed(() => {
    const r = this.negocio().rangoPrecio;
    return r ? '$'.repeat(Math.min(r, 3)) : null;
  });
  protected readonly etiquetaPrecio = computed(() => ('precioIcono_' + Math.min(this.negocio().rangoPrecio ?? 1, 3)) as Clave);
  protected readonly precio = computed(() => {
    const n = this.negocio();
    if (n.precioDesde == null) return null;
    return { monto: this.i18n.precio(n.precioDesde, n.moneda), unidad: n.unidadPrecio ? this.i18n.t(('unidad_' + n.unidadPrecio) as Clave) : '' };
  });
  protected readonly distancia = computed(() => {
    const d = this.negocio().distanciaM;
    return d == null ? null : this.i18n.tf('distanciaKm', { d: (d / 1000).toFixed(1) });
  });
}
