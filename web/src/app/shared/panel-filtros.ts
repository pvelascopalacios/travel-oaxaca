import { Component, computed, inject, input, output } from '@angular/core';
import { I18n } from '../core/i18n';
import { IDIOMAS_ATENCION, Filtros, alternar } from '../core/filtros';
import { Servicio } from '../core/modelos';
import { Clave } from '../core/textos';

export interface OpcionTipo {
  clave: string;
  nombre: string;
  total: number;
}

/** Panel de filtros de negocios. Cada cambio sale como un trozo de Filtros; la página lo pone en la dirección. */
@Component({
  selector: 'app-panel-filtros',
  templateUrl: './panel-filtros.html',
  styleUrl: './panel-filtros.scss',
})
export class PanelFiltros {
  protected readonly i18n = inject(I18n);
  readonly filtros = input.required<Filtros>();
  readonly tipos = input<OpcionTipo[]>([]);
  readonly servicios = input<Servicio[]>([]);
  readonly conPrecio = input(true);
  readonly conAbierto = input(false);
  readonly conIdiomas = input(false);
  /** Para identificar los campos si hay dos paneles en la página (barra lateral y hoja móvil). */
  readonly prefijo = input('f');
  readonly cambio = output<Partial<Filtros>>();

  protected readonly precios = [1, 2, 3];
  protected readonly idiomas = IDIOMAS_ATENCION;

  protected readonly etiquetaIdioma = (i: string) => this.i18n.t(('idioma_' + i) as Clave);

  protected readonly serviciosDisponibles = computed(() => this.servicios());

  protected tipo(clave: string): void {
    this.cambio.emit({ tipos: alternar(this.filtros().tipos, clave) });
  }
  protected servicio(clave: string): void {
    this.cambio.emit({ servicios: alternar(this.filtros().servicios, clave) });
  }
  protected idioma(codigo: string): void {
    this.cambio.emit({ idiomas: alternar(this.filtros().idiomas, codigo) });
  }
  protected precio(n: number): void {
    this.cambio.emit({ precio: this.filtros().precio === n ? null : n });
  }
  protected abierto(v: boolean): void {
    this.cambio.emit({ abierto: v });
  }
}
