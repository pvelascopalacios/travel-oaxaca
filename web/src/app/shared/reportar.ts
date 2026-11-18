import { AfterViewInit, Component, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api';
import { MAX_DETALLE_REPORTE, MOTIVOS_CONTENIDO, MOTIVOS_FICHA, validarReporte } from '../core/comunidad';
import { leerError } from '../core/cuenta';
import { I18n } from '../core/i18n';
import { TipoReporte } from '../core/modelos';

/** Ventana para reportar un comentario, una reseña o un problema de la ficha de un negocio. Se muestra solo con sesión. */
@Component({
  selector: 'app-reportar',
  imports: [FormsModule],
  template: `
    <dialog #dlg class="dlg" [attr.aria-labelledby]="'rep-t'" (close)="cerrar.emit()" (cancel)="cerrar.emit()">
      <form (ngSubmit)="enviar()" novalidate>
        <h2 id="rep-t">{{ titulo() }}</h2>
        @if (hecho()) {
          <p class="ok" role="status">{{ i18n.t('reporteGracias') }}</p>
          <button type="button" class="boton" (click)="cerrarDlg()">{{ i18n.t('listaCerrar') }}</button>
        } @else {
          <fieldset>
            <legend class="visualmente-oculto">{{ titulo() }}</legend>
            @for (m of motivos(); track m) {
              <label class="op" [class.on]="motivo() === m">
                <input type="radio" name="motivo" [value]="m" [checked]="motivo() === m" (change)="motivo.set(m)" />
                {{ i18n.tDinamico(tipo() === 'ficha' ? 'reporteFicha' : 'reporteMotivo', m) }}
              </label>
            }
          </fieldset>
          <label class="detalle">
            <span class="visualmente-oculto">{{ i18n.t('reporteDetalle') }}</span>
            <textarea name="detalle" rows="3" [maxLength]="max" [placeholder]="i18n.t('reporteDetalle')" [(ngModel)]="detalle"></textarea>
          </label>
          @if (error()) { <p class="aviso-error" role="alert">{{ error() }}</p> }
          <div class="acciones">
            <button type="submit" class="boton" [disabled]="enviando()">{{ i18n.t('reporteEnviar') }}</button>
            <button type="button" class="boton secundario" (click)="cerrarDlg()">{{ i18n.t('cancelar') }}</button>
          </div>
        }
      </form>
    </dialog>
  `,
  styles: `
    .dlg { width: min(92vw, 440px); padding: 18px; border: 1px solid var(--linea); border-radius: 16px; background: var(--papel); color: var(--tinta); box-shadow: 0 12px 32px rgb(0 0 0 / 22%); }
    .dlg::backdrop { background: rgb(0 0 0 / 45%); }
    form { display: grid; gap: 12px; }
    h2 { margin: 0; font: 700 1.1rem var(--fuente-titulo); }
    fieldset { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; }
    .op { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 12px; border: 1.5px solid var(--linea); border-radius: 10px; cursor: pointer; }
    .op.on { border-color: var(--grana); background: var(--cantera); }
    textarea { width: 100%; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--linea); border-radius: 10px; background: var(--fondo); color: var(--tinta); font: inherit; }
    .acciones { display: flex; flex-wrap: wrap; gap: 8px; }
    .ok { margin: 0; color: var(--sierra); font-weight: 600; }
  `,
})
export class Reportar implements AfterViewInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);
  readonly tipo = input.required<TipoReporte>();
  /** Id del comentario, de la reseña o del negocio (si es de la ficha). */
  readonly objetivoId = input.required<string>();
  readonly cerrar = output<void>();

  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected readonly max = MAX_DETALLE_REPORTE;
  protected readonly motivo = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly hecho = signal(false);
  protected readonly error = signal<string | null>(null);
  protected detalle = '';

  protected readonly motivos = () => (this.tipo() === 'ficha' ? MOTIVOS_FICHA : MOTIVOS_CONTENIDO);
  protected readonly titulo = () =>
    this.i18n.t(this.tipo() === 'ficha' ? 'reporteTituloFicha' : this.tipo() === 'resena' ? 'reporteTituloResena' : 'reporteTituloComentario');

  ngAfterViewInit(): void {
    const d = this.dlg().nativeElement;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }

  protected cerrarDlg(): void {
    const d = this.dlg().nativeElement;
    if (typeof d.close === 'function') d.close();
    else this.cerrar.emit();
  }

  protected enviar(): void {
    const falla = validarReporte(this.motivo(), this.detalle);
    if (falla) {
      this.error.set(this.i18n.t(falla));
      return;
    }
    this.error.set(null);
    this.enviando.set(true);
    const detalle = this.detalle.trim() || null;
    const t = this.tipo();
    const llamada = t === 'ficha' ? this.api.reportarFicha(this.objetivoId(), this.motivo()!, detalle) : this.api.reportarContenido(t, this.objetivoId(), this.motivo()!, detalle);
    llamada.subscribe({
      next: () => { this.enviando.set(false); this.hecho.set(true); },
      error: (e) => { this.enviando.set(false); this.error.set(leerError(e, this.i18n.t('reporteError')).general); },
    });
  }
}
