import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { estadoInfo } from '../core/portal';
import { tituloLista } from '../core/opciones';

/** Encabezado común de «Fotos» y de «Menú / Habitaciones / Tours / Productos»: nombre, estado y las dos pestañas. */
@Component({
  selector: 'app-cabecera-opciones',
  imports: [RouterLink],
  template: `
    <header class="cab-o">
      <div class="fila-cab">
        <h1>{{ nombre() }}</h1>
        <span class="estado" [class]="info().clase">{{ info().texto }}</span>
      </div>
      <nav class="seg-t" aria-label="Fotos y opciones">
      <a [routerLink]="['/negocios', id(), 'fotos']" [class.activo]="activa() === 'fotos'" [attr.aria-current]="activa() === 'fotos' ? 'page' : null">Fotos</a>
      <a [routerLink]="['/negocios', id(), 'opciones']" [class.activo]="activa() === 'opciones'" [attr.aria-current]="activa() === 'opciones' ? 'page' : null">{{ titulo() }}</a>
      </nav>
    </header>
  `,
  styles: `
    :host { display: contents; }
    .cab-o { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
    .cab-o h1 { font-size: 1.9rem; overflow-wrap: anywhere; }
    .seg-t { display: inline-flex; background: var(--cantera); border-radius: 999px; padding: 4px; }
    .seg-t a { display: inline-flex; align-items: center; min-height: 40px; padding: 0 20px; border-radius: 999px; text-decoration: none; font-weight: 700; font-size: 0.9rem; color: var(--suave); }
    .seg-t a.activo { background: #fff; color: var(--tinta); box-shadow: 0 1px 3px rgb(43 33 24 / 15%); }
    @media (max-width: 640px) { .cab-o h1 { font-size: 1.5rem; } }
  `,
})
export class CabeceraOpciones {
  readonly id = input.required<string>();
  readonly nombre = input.required<string>();
  readonly estado = input.required<string>();
  readonly raiz = input<string | null>(null);
  readonly activa = input.required<'fotos' | 'opciones'>();
  protected readonly info = computed(() => estadoInfo(this.estado()));
  protected readonly titulo = computed(() => tituloLista(this.raiz()));
}
