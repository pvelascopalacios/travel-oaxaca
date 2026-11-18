import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Catalogos } from '../core/catalogos';
import { Municipio } from '../core/modelos';

/** Elige un municipio escribiendo parte del nombre. Los municipios se cargan una vez y se filtran aquí mismo. */
@Component({
  selector: 'app-selector-municipio',
  imports: [FormsModule],
  template: `
    <div class="sel" [class.error]="error()">
      <label>{{ titulo() }}
        @if (elegido(); as e) {
          <span class="elegido"><b>{{ e.nombre }}</b> <button type="button" class="enlace" (click)="cambio.emit(null)">Cambiar</button></span>
        } @else {
          <input type="search" autocomplete="off" placeholder="Escribe parte del nombre…" [ngModel]="texto()" (ngModelChange)="texto.set($event)" name="buscar-municipio" />
        }
        @if (error(); as m) { <span class="msg">{{ m }}</span> }
      </label>
      @if (!elegido() && texto().trim().length >= 2) {
        <ul class="lista" role="listbox" aria-label="Municipios">
          @if (!cat.cargado()) { <li class="suave">Cargando municipios…</li> }
          @else if (coincidencias().length === 0) { <li class="suave">Sin resultados.</li> }
          @for (m of coincidencias(); track m.id) {
            <li><button type="button" role="option" (click)="elegir(m)">{{ m.nombre }}</button></li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .sel { display: grid; gap: 4px; }
    .elegido { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; min-height: 44px; padding: 8px 12px; border: 1.5px solid var(--linea); border-radius: 12px; background: var(--fondo); font-weight: 400; }
    .lista { list-style: none; margin: 0; padding: 4px; border: 1px solid var(--linea); border-radius: 12px; background: var(--papel); display: grid; gap: 2px; box-shadow: var(--sombra); }
    .lista li { padding: 0 6px; }
    .lista li.suave { padding: 8px 10px; }
    .lista li button { all: unset; display: block; width: 100%; min-height: 40px; padding: 8px 10px; box-sizing: border-box; cursor: pointer; border-radius: 8px; }
    .lista li button:hover, .lista li button:focus-visible { background: var(--cantera); }
  `,
})
export class SelectorMunicipio {
  readonly titulo = input('Municipio');
  readonly valor = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly cambio = output<Municipio | null>();

  protected readonly cat = inject(Catalogos);
  protected readonly texto = signal('');
  protected readonly elegido = computed(() => {
    const id = this.valor();
    if (!id) return null;
    const m = this.cat.municipiosPorId().get(id);
    return { id, nombre: m?.nombre || (this.cat.cargado() ? 'Municipio elegido' : 'Cargando…') };
  });
  protected readonly coincidencias = computed(() => {
    const t = normalizar(this.texto());
    return t.length < 2 ? [] : this.cat.municipios().filter((m) => normalizar(m.nombre).includes(t)).slice(0, 8);
  });

  constructor() {
    this.cat.cargar();
  }

  protected elegir(m: Municipio): void {
    this.texto.set('');
    this.cambio.emit(m);
  }
}

const normalizar = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
