import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ErrorApi } from '../core/cuenta';
import { I18n } from '../core/i18n';
import { entradaDeLista, hayErroresLista, validarLista, ErroresLista } from '../core/listas';
import { ListaEntrada } from '../core/modelos';
import { Clave } from '../core/textos';

/** Formulario para crear o editar una lista o itinerario. Valida lo básico y deja a la API la última palabra. */
@Component({
  selector: 'app-formulario-lista',
  imports: [FormsModule],
  template: `
    <form class="formulario" (ngSubmit)="enviarForm()" novalidate>
      <div class="campos">
        <label [class.error]="errores().nombre || campoApi('nombre')">
          {{ i18n.t('listaNombre') }}
          <input type="text" name="nombre" maxlength="80" autocomplete="off" [(ngModel)]="nombre" />
          @if (errores().nombre; as k) { <span class="msg">{{ i18n.t(k) }}</span> }
          @else if (campoApi('nombre'); as m) { <span class="msg">{{ m }}</span> }
        </label>
        <label>
          {{ i18n.t('listaTipo') }}
          <select name="tipo" [(ngModel)]="tipo">
            <option value="lista">{{ i18n.t('listaTipoLista') }}</option>
            <option value="itinerario">{{ i18n.t('listaTipoItinerario') }}</option>
          </select>
        </label>
        @if (tipo === 'itinerario') {
          <label>
            {{ i18n.t('listaDesde') }}
            <input type="date" name="inicio" [(ngModel)]="inicio" />
          </label>
          <label [class.error]="errores().fechaFin || campoApi('fechaFin')">
            {{ i18n.t('listaHasta') }}
            <input type="date" name="fin" [min]="inicio" [(ngModel)]="fin" />
            @if (errores().fechaFin; as k) { <span class="msg">{{ i18n.t(k) }}</span> }
            @else if (campoApi('fechaFin'); as m) { <span class="msg">{{ m }}</span> }
          </label>
        }
      </div>
      @if (tipo === 'itinerario') { <p class="ayuda">{{ i18n.t('listaFechasAyuda') }}</p> }
      <label class="check">
        <input type="checkbox" name="publica" [(ngModel)]="publica" />
        <span>{{ i18n.t('listaPublica') }}</span>
      </label>
      @if (errorApi().general; as g) { <p class="aviso" role="alert">{{ g }}</p> }
      <div class="botones">
        <button type="submit" class="boton" [disabled]="ocupado()">{{ i18n.t(ocupado() ? 'listaCreando' : etiqueta()) }}</button>
        @if (conCancelar()) { <button type="button" class="boton secundario" (click)="cancelar.emit()">{{ i18n.t('listaCancelar') }}</button> }
      </div>
    </form>
  `,
  styles: `
    .formulario { display: grid; gap: 14px; }
    .campos { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); }
    label { display: grid; gap: 6px; min-width: 0; font-weight: 600; font-size: 0.9rem; }
    input[type='text'], input[type='date'], select {
      width: 100%; min-height: 46px; padding: 10px 14px; border: 1.5px solid var(--linea); border-radius: 12px;
      background: var(--fondo); color: var(--tinta); font: 400 1rem var(--fuente);
    }
    .error input { border-color: var(--grana); }
    .msg { color: var(--grana); font-size: 0.84rem; font-weight: 500; }
    .ayuda { margin: 0; color: var(--tinta-suave); font-size: 0.84rem; }
    .check { display: flex; align-items: flex-start; gap: 10px; font-weight: 400; font-size: 0.92rem; }
    .check input { flex: none; width: 20px; height: 20px; margin-top: 2px; }
    .aviso { margin: 0; padding: 12px 14px; border-radius: 12px; background: #fdf0f4; color: var(--noche); font-size: 0.9rem; }
    .botones { display: flex; flex-wrap: wrap; gap: 10px; }
    button[disabled] { opacity: 0.6; cursor: progress; }
  `,
})
export class FormularioLista implements OnInit {
  protected readonly i18n = inject(I18n);
  readonly valor = input<ListaEntrada | null>(null);
  readonly etiqueta = input<Clave>('listaCrear');
  readonly ocupado = input(false);
  readonly conCancelar = input(false);
  readonly errorApi = input<ErrorApi>({ general: null, campos: {} });
  readonly enviar = output<ListaEntrada>();
  readonly cancelar = output<void>();

  protected nombre = '';
  protected tipo: 'lista' | 'itinerario' = 'lista';
  protected inicio = '';
  protected fin = '';
  protected publica = false;
  protected readonly errores = signal<ErroresLista>({});

  ngOnInit(): void {
    const v = this.valor();
    if (!v) return;
    this.nombre = v.nombre;
    this.tipo = v.esItinerario ? 'itinerario' : 'lista';
    this.inicio = v.fechaInicio ?? '';
    this.fin = v.fechaFin ?? '';
    this.publica = v.publica;
  }

  protected campoApi(n: string): string | null {
    return this.errorApi().campos[n] ?? null;
  }

  /** Vacía el formulario después de crear. */
  limpiar(): void {
    this.nombre = '';
    this.tipo = 'lista';
    this.inicio = this.fin = '';
    this.publica = false;
    this.errores.set({});
  }

  protected enviarForm(): void {
    const it = this.tipo === 'itinerario';
    const e = validarLista(this.nombre, it, this.inicio, this.fin);
    this.errores.set(e);
    if (hayErroresLista(e)) return;
    this.enviar.emit(entradaDeLista(this.nombre, it, this.inicio, this.fin, this.publica));
  }
}
