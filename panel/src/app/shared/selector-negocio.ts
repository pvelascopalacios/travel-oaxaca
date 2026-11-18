import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap, catchError } from 'rxjs';
import { Api } from '../core/api';
import { NegocioAdmin } from '../core/modelos';
import { estadoNegocioInfo } from '../core/cobros';

export interface NegocioElegido {
  id: string;
  nombre: string;
}

/** Busca un negocio por nombre y lo elige de una lista corta. */
@Component({
  selector: 'app-selector-negocio',
  imports: [FormsModule],
  template: `
    <div class="sel" [class.error]="error()">
      <label>{{ titulo() }}
        @if (elegido(); as e) {
          <span class="elegido"><b>{{ e.nombre }}</b> <button type="button" class="enlace" (click)="cambiar()">Cambiar</button></span>
        } @else {
          <input type="search" autocomplete="off" placeholder="Escribe parte del nombre…" [ngModel]="texto()" (ngModelChange)="escribir($event)" name="buscar-negocio" />
        }
        @if (error(); as m) { <span class="msg">{{ m }}</span> }
      </label>
      @if (!elegido() && texto().trim().length >= 2) {
        <ul class="lista" role="listbox" aria-label="Resultados">
          @if (cargando()) { <li class="suave">Buscando…</li> }
          @else if (resultados().length === 0) { <li class="suave">Sin resultados.</li> }
          @for (n of resultados(); track n.id) {
            <li><button type="button" role="option" (click)="elegir(n)">{{ n.nombreComercial }} <span class="estado" [class]="estado(n.estado).clase">{{ estado(n.estado).texto }}</span> <small>{{ n.municipioNombre }}</small></button></li>
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
    .lista li { padding: 8px 10px; }
    .lista li button { all: unset; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; width: 100%; min-height: 40px; padding: 4px 10px; box-sizing: border-box; cursor: pointer; border-radius: 8px; }
    .lista li button:hover, .lista li button:focus-visible { background: var(--cantera); }
    small { color: var(--suave); }
  `,
})
export class SelectorNegocio {
  readonly titulo = input('Negocio');
  readonly error = input<string | null>(null);
  readonly elegido = input<NegocioElegido | null>(null);
  readonly elegir_ = output<NegocioElegido | null>({ alias: 'cambio' });

  private readonly api = inject(Api);
  protected readonly texto = signal('');
  protected readonly cargando = signal(false);
  protected readonly resultados = signal<NegocioAdmin[]>([]);
  protected readonly estado = estadoNegocioInfo;
  private readonly busqueda = new Subject<string>();

  constructor() {
    this.busqueda
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((t) => {
          if (t.trim().length < 2) return of(null);
          this.cargando.set(true);
          return this.api.negocios({ q: t, tamano: 6 }).pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((p) => {
        this.cargando.set(false);
        this.resultados.set(p?.elementos ?? []);
      });
  }

  protected escribir(t: string): void {
    this.texto.set(t);
    this.busqueda.next(t);
  }

  protected elegir(n: NegocioAdmin): void {
    this.texto.set('');
    this.resultados.set([]);
    this.elegir_.emit({ id: n.id, nombre: n.nombreComercial });
  }

  protected cambiar(): void {
    this.elegir_.emit(null);
  }
}
