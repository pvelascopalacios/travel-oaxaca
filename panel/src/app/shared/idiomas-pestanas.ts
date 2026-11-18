import { Component, input, output } from '@angular/core';
import { Idioma } from '../core/modelos';

/** Una pestaña por idioma. El español es obligatorio; un punto marca los idiomas que ya tienen texto. */
@Component({
  selector: 'app-idiomas-pestanas',
  template: `
    <div class="idiomas" role="tablist" aria-label="Idioma del texto">
      @for (i of idiomas(); track i.codigo) {
        <button type="button" role="tab" [class.on]="activo() === i.codigo" [attr.aria-selected]="activo() === i.codigo" (click)="cambio.emit(i.codigo)">
          {{ i.nombre }}@if (i.codigo === 'es') { <span aria-hidden="true"> *</span> }
          @if (conTexto().includes(i.codigo) && i.codigo !== 'es') { <span class="punto" title="Tiene texto"></span> }
          @if (errores().includes(i.codigo)) { <span class="err" title="Tiene errores">!</span> }
        </button>
      }
    </div>
  `,
  styles: `
    .idiomas { display: flex; flex-wrap: wrap; gap: 6px; }
    button { min-height: 40px; padding: 0 14px; border-radius: 999px; border: 1.5px solid var(--linea); background: var(--papel); color: var(--tinta); font: 600 0.84rem var(--fuente); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    button.on { background: var(--noche, #1d2433); color: #fff; border-color: var(--noche, #1d2433); }
    .punto { width: 8px; height: 8px; border-radius: 50%; background: var(--sierra); }
    .err { background: var(--grana); color: #fff; border-radius: 50%; width: 16px; height: 16px; display: inline-grid; place-items: center; font-size: 0.7rem; }
  `,
})
export class IdiomasPestanas {
  readonly idiomas = input.required<Idioma[]>();
  readonly activo = input.required<string>();
  readonly conTexto = input<string[]>([]);
  readonly errores = input<string[]>([]);
  readonly cambio = output<string>();
}
