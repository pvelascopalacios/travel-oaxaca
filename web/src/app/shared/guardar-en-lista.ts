import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, HostListener, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { leerError } from '../core/cuenta';
import { I18n } from '../core/i18n';
import { diasDeItinerario, ordenarListas } from '../core/listas';
import { ListaResumen, TipoElemento } from '../core/modelos';
import { Sesion } from '../core/sesion';

/** Botón «＋ Guardar en lista»: abre un panel con mis listas para agregar este negocio, lugar o ruta. */
@Component({
  selector: 'app-guardar-en-lista',
  imports: [FormsModule, RouterLink],
  template: `
    <button type="button" class="boton secundario" [attr.aria-expanded]="abierto()" aria-haspopup="true" (click)="alternar()">
      <span aria-hidden="true">＋</span> {{ i18n.t('listaGuardarEn') }}
    </button>
    @if (abierto()) {
      <div class="panel" role="group" [style.left.px]="desplazo()" [attr.aria-label]="i18n.t('listaGuardarEnTitulo')">
        <div class="cabeza">
          <strong>{{ i18n.t('listaGuardarEnTitulo') }}</strong>
          <button type="button" class="x" [attr.aria-label]="i18n.t('listaCerrar')" (click)="abierto.set(false)">✕</button>
        </div>
        @if (aviso(); as a) { <p class="msg ok" role="status">{{ a }}</p> }
        @if (error(); as e) { <p class="msg" role="alert">{{ e }}</p> }
        @if (listas() === null) {
          <p class="suave" aria-live="polite">{{ i18n.t('cargando') }}</p>
        } @else {
          @if (listas()!.length === 0) { <p class="suave">{{ i18n.t('listaSinListas') }}</p> }
          <ul>
            @for (l of listas(); track l.id) {
              <li>
                <button type="button" class="op" [disabled]="ocupado()" (click)="agregar(l)">
                  <span>{{ l.nombre }}</span>
                  <span class="suave">{{ l.esItinerario ? i18n.t('listaItinerarioEtiqueta') : '' }}</span>
                </button>
                @if (l.esItinerario) {
                  <label class="dia">
                    {{ i18n.t('listaDiaOpcional') }}
                    <select [ngModel]="dias[l.id] ?? ''" (ngModelChange)="dias[l.id] = $event" [name]="'dia-' + l.id">
                      <option value="">—</option>
                      @for (d of opcionesDia(l); track d) { <option [value]="d">{{ i18n.tf('listaDia', { n: d }) }}</option> }
                    </select>
                  </label>
                }
              </li>
            }
          </ul>
          <form class="nueva" (ngSubmit)="crearYAgregar()">
            <label>
              {{ i18n.t('listaCrearNueva') }}
              <input type="text" name="nueva" maxlength="80" autocomplete="off" [placeholder]="i18n.t('listaNombreNueva')" [(ngModel)]="nombreNueva" />
            </label>
            <button type="submit" class="boton chico" [disabled]="ocupado() || !nombreNueva.trim()">＋</button>
          </form>
          <a class="ver" [routerLink]="['/', i18n.lang(), 'listas']">{{ i18n.t('listasTitulo') }} →</a>
        }
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: block; }
    .boton { width: 100%; }
    .panel {
      position: absolute; z-index: 30; left: 0; top: calc(100% + 6px); display: grid; gap: 10px;
      width: min(92vw, 340px); max-width: calc(100vw - 32px); max-height: 70vh; overflow: auto;
      padding: 14px; border: 1px solid var(--linea); border-radius: 16px; background: var(--papel); box-shadow: 0 12px 32px rgb(0 0 0 / 18%);
    }
    .cabeza { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .x { min-width: 36px; min-height: 36px; border: 0; border-radius: 50%; background: none; color: var(--tinta-suave); font-size: 1rem; cursor: pointer; }
    ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
    .op {
      display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; padding: 8px 12px;
      border: 1.5px solid var(--linea); border-radius: 12px; background: var(--papel); color: var(--tinta); font: 600 0.92rem var(--fuente); text-align: left; cursor: pointer;
    }
    .op:hover { border-color: var(--grana); }
    .op span { overflow-wrap: anywhere; }
    .dia { display: flex; align-items: center; gap: 8px; margin-top: 4px; font-size: 0.82rem; color: var(--tinta-suave); }
    .dia select { flex: 1; min-height: 36px; padding: 0 8px; border: 1.5px solid var(--linea); border-radius: 10px; background: var(--fondo); color: var(--tinta); font: 400 0.9rem var(--fuente); }
    .nueva { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end; }
    .nueva label { display: grid; gap: 4px; font-size: 0.84rem; font-weight: 600; }
    .nueva input { width: 100%; min-height: 40px; padding: 6px 12px; border: 1.5px solid var(--linea); border-radius: 12px; background: var(--fondo); color: var(--tinta); font: 400 0.95rem var(--fuente); }
    .chico { min-height: 40px; width: auto; padding-inline: 16px; }
    .suave { margin: 0; color: var(--tinta-suave); font-size: 0.84rem; }
    .msg { margin: 0; padding: 8px 12px; border-radius: 10px; background: #fdf0f4; color: var(--noche); font-size: 0.86rem; }
    .msg.ok { background: rgb(65 105 47 / 12%); color: var(--sierra); }
    .ver { color: var(--grana); font-weight: 600; font-size: 0.9rem; }
    button[disabled] { opacity: 0.6; cursor: progress; }
  `,
})
export class GuardarEnLista {
  protected readonly i18n = inject(I18n);
  private readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly yo = inject(ElementRef<HTMLElement>);

  readonly tipo = input.required<TipoElemento>();
  readonly elementoId = input.required<string>();

  protected readonly abierto = signal(false);
  /** Cuánto se corre el panel a la izquierda para no salirse de la pantalla. */
  protected readonly desplazo = signal(0);
  protected readonly listas = signal<ListaResumen[] | null>(null);
  protected readonly ocupado = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected dias: Record<string, string> = {};
  protected nombreNueva = '';

  /** Se cierra al tocar fuera o con Escape. */
  @HostListener('document:click', ['$event'])
  protected fuera(e: Event): void {
    if (this.abierto() && !this.yo.nativeElement.contains(e.target as Node)) this.abierto.set(false);
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    this.abierto.set(false);
  }

  protected alternar(): void {
    if (!this.sesion.autenticado()) {
      void this.router.navigate(['/', this.i18n.lang(), 'ingresar'], { queryParams: { volver: this.router.url.split('#')[0] } });
      return;
    }
    const abrir = !this.abierto();
    if (abrir) this.acomodar();
    this.abierto.set(abrir);
    this.aviso.set(null);
    this.error.set(null);
    if (abrir) this.cargar();
  }

  private acomodar(): void {
    const r = (this.yo.nativeElement as HTMLElement).getBoundingClientRect();
    const ancho = Math.min(innerWidth * 0.92, 340);
    const exceso = r.left + ancho - (innerWidth - 16);
    this.desplazo.set(exceso > 0 ? -Math.min(exceso, Math.max(0, r.left - 16)) : 0);
  }

  private cargar(): void {
    this.api.listas().subscribe({
      next: (l) => this.listas.set(ordenarListas(l)),
      error: () => { this.listas.set([]); this.error.set(this.i18n.t('errorCarga')); },
    });
  }

  protected opcionesDia(l: ListaResumen): number[] {
    const n = diasDeItinerario(l.fechaInicio, l.fechaFin) ?? 7;
    return Array.from({ length: n }, (_, i) => i + 1);
  }

  private mensajeError(e: unknown): string {
    if (e instanceof HttpErrorResponse && e.status === 409) return this.i18n.t('listaYaEsta');
    return leerError(e, this.i18n.t('errorCarga')).general ?? this.i18n.t('errorCarga');
  }

  protected agregar(l: ListaResumen): void {
    if (this.ocupado()) return;
    this.ocupado.set(true);
    this.aviso.set(null);
    this.error.set(null);
    const d = this.dias[l.id];
    this.api.agregarALista(l.id, { tipo: this.tipo(), id: this.elementoId(), dia: l.esItinerario && d ? Number(d) : null }).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.aviso.set(this.i18n.tf('listaAgregada', { nombre: l.nombre }));
        this.listas.set((this.listas() ?? []).map((x) => (x.id === l.id ? { ...x, totalElementos: x.totalElementos + 1 } : x)));
      },
      error: (e) => { this.ocupado.set(false); this.error.set(this.mensajeError(e)); },
    });
  }

  protected crearYAgregar(): void {
    const nombre = this.nombreNueva.trim();
    if (!nombre || this.ocupado()) return;
    this.ocupado.set(true);
    this.aviso.set(null);
    this.error.set(null);
    this.api.crearLista({ nombre, esItinerario: false, fechaInicio: null, fechaFin: null, publica: false }).subscribe({
      next: (r) => {
        this.nombreNueva = '';
        this.listas.set(ordenarListas([...(this.listas() ?? []), r.datos]));
        this.ocupado.set(false);
        this.agregar(r.datos);
      },
      error: (e) => { this.ocupado.set(false); this.error.set(this.mensajeError(e)); },
    });
  }
}
