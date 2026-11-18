import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

export interface Opcion {
  id: string;
  nombre: string;
  detalle?: string;
}

/** Busca en la API mientras se escribe y deja elegir una opción (lugares, por ejemplo). La función `buscar` la pone quien lo usa. */
@Component({
  selector: 'app-selector-busqueda',
  imports: [FormsModule],
  template: `
    <div class="sel" [class.error]="error()">
      <label>{{ titulo() }}
        @if (elegido(); as e) {
          <span class="elegido"><b>{{ e.nombre }}</b> @if (quitable()) { <button type="button" class="enlace" (click)="cambio.emit(null)">Quitar</button> }</span>
        } @else {
          <input type="search" autocomplete="off" [placeholder]="placeholder()" [ngModel]="texto()" (ngModelChange)="escribir($event)" name="buscar-opcion" />
        }
        @if (error(); as m) { <span class="msg">{{ m }}</span> }
      </label>
      @if (!elegido() && texto().trim().length >= 2) {
        <ul class="lista" role="listbox" [attr.aria-label]="titulo()">
          @if (cargando()) { <li class="suave">Buscando…</li> }
          @else if (resultados().length === 0) { <li class="suave">Sin resultados.</li> }
          @for (o of resultados(); track o.id) {
            <li><button type="button" role="option" (click)="elegir(o)">{{ o.nombre }} @if (o.detalle) { <small>{{ o.detalle }}</small> }</button></li>
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
    .lista li button { all: unset; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; width: 100%; min-height: 40px; padding: 4px 10px; box-sizing: border-box; cursor: pointer; border-radius: 8px; }
    .lista li button:hover, .lista li button:focus-visible { background: var(--cantera); }
    small { color: var(--suave); }
  `,
})
export class SelectorBusqueda {
  readonly titulo = input('Buscar');
  readonly placeholder = input('Escribe parte del nombre…');
  readonly buscar = input.required<(texto: string) => Observable<Opcion[]>>();
  readonly elegido = input<Opcion | null>(null);
  readonly quitable = input(true);
  readonly error = input<string | null>(null);
  readonly cambio = output<Opcion | null>();

  protected readonly texto = signal('');
  protected readonly cargando = signal(false);
  protected readonly resultados = signal<Opcion[]>([]);
  private readonly busqueda = new Subject<string>();

  constructor() {
    this.busqueda
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((t) => {
          if (t.trim().length < 2) return of(null);
          this.cargando.set(true);
          return this.buscar()(t).pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((r) => {
        this.cargando.set(false);
        this.resultados.set(r ?? []);
      });
  }

  protected escribir(t: string): void {
    this.texto.set(t);
    this.busqueda.next(t);
  }

  protected elegir(o: Opcion): void {
    this.texto.set('');
    this.resultados.set([]);
    this.cambio.emit(o);
  }
}
