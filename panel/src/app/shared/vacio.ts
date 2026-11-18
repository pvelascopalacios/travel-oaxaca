import { Component, ViewEncapsulation, input } from '@angular/core';

export type TipoVacio = 'ok' | 'nuevo' | 'filtro';
export type IconoVacio = 'check' | 'plus' | 'filtro' | 'foto' | 'chart' | 'cash';

const ICONOS: Record<IconoVacio, string> = {
  check: 'M5 12l4 4 10-10',
  plus: 'M12 5v14M5 12h14',
  filtro: 'M4 5h16l-6 8v5l-4 2v-7z',
  foto: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM4 18l5-5 4 4 3-3 4 4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  cash: 'M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5',
};

/**
 * Pantalla sin datos con una salida.
 * ok = no hay trabajo pendiente (verde) · nuevo = aún no existe nada (guinda) · filtro = los filtros no encuentran nada (azul).
 * Dentro van, opcionalmente, un texto o los chips de filtros activos y, en un contenedor class="vacio-e-bs", los botones (.vb, .vb.p).
 */
@Component({
  selector: 'app-vacio',
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="vacio-e" [class]="'vacio-e ' + tipo()" role="status">
      <span class="vacio-e-ico" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path [attr.d]="ruta()" /></svg>
      </span>
      <h2 class="vacio-e-ti">{{ titulo() }}</h2>
      <ng-content />
    </section>
  `,
  styles: `
    .vacio-e { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 34px 22px; background: var(--papel); border: 1px solid var(--linea); border-radius: 16px; }
    .vacio-e-ico { width: 56px; height: 56px; border-radius: 18px; display: flex; align-items: center; justify-content: center; background: var(--ok); color: var(--sierra); }
    .vacio-e.nuevo .vacio-e-ico { background: var(--aviso); color: var(--grana); }
    .vacio-e.filtro .vacio-e-ico { background: var(--azul); color: var(--laguna); }
    .vacio-e-ti { margin: 0; font: 800 1.25rem/1.2 var(--fuente-titulo); text-wrap: balance; }
    .vacio-e p { margin: 0; max-width: 34rem; color: var(--suave); line-height: 1.5; }
    .vacio-e-bs { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 6px; }
    .vacio-e-chips { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
    .vacio-e .vb { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1.5px solid var(--linea); background: var(--papel); color: var(--tinta); font: 600 0.88rem var(--fuente); cursor: pointer; text-decoration: none; }
    .vacio-e .vb.p { background: var(--grana); border-color: var(--grana); color: #fff; }
    .vacio-e .vb:focus-visible { outline: 3px solid var(--ocre); outline-offset: 2px; }
    .vacio-e .chip-f { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 0 12px; border-radius: 999px; border: 0; background: var(--cantera); color: var(--tinta); font: 600 0.8rem var(--fuente); cursor: pointer; }
  `,
})
export class VacioEstado {
  readonly tipo = input<TipoVacio>('ok');
  readonly icono = input<IconoVacio>('check');
  readonly titulo = input.required<string>();
  protected ruta(): string {
    return ICONOS[this.icono()];
  }
}
