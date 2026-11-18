import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { vacioANull } from '../../core/edicion';
import { Envio } from '../../core/envio';
import { Ficha, Traduccion, ResultadoCambio } from '../../core/modelos';
import { EstadoGuardado } from '../../shared/estado-guardado';

const NOMBRES: Record<string, string> = { es: 'Español', en: 'English' };
const VACIA = (): Traduccion => ({ descripcionCorta: '', descripcion: '', politicas: '' });

/** Descripción corta, completa y políticas, por idioma. Español primero; el inglés es opcional. */
@Component({
  selector: 'app-seccion-descripcion',
  imports: [FormsModule, EstadoGuardado],
  template: `
    <form (ngSubmit)="guardar()" novalidate>
      <fieldset class="bloque" [disabled]="soloLectura()">
        <div class="tarjeta">
          <div class="fila-cab">
            <h2>Descripción</h2>
            <div class="segmento" role="group" aria-label="Idioma">
              @for (c of idiomas(); track c) {
                <button type="button" [attr.aria-pressed]="actual() === c" (click)="actual.set(c)">{{ nombre(c) }}</button>
              }
            </div>
          </div>

          @if (t(); as x) {
            <label [class.error]="errorCorta()">Descripción corta <span class="ayuda">(se ve en las tarjetas)</span>
              <input type="text" name="corta" maxlength="160" [(ngModel)]="x.descripcionCorta" />
              <span class="contador" [class.msg]="(x.descripcionCorta ?? '').length > 150">{{ (x.descripcionCorta ?? '').length }} / 160</span>
              @if (errorCorta(); as m) { <span class="msg">{{ m }}</span> }
            </label>
            <label [class.error]="envio.campo('descripcion')">Descripción completa
              <textarea name="larga" rows="7" maxlength="8000" [(ngModel)]="x.descripcion"></textarea>
              <span class="contador">{{ (x.descripcion ?? '').length }} / 8000</span>
              @if (envio.campo('descripcion'); as m) { <span class="msg">{{ m }}</span> }
            </label>
            <label [class.error]="envio.campo('politicas')">Políticas <span class="ayuda">(opcional: reservaciones, cancelaciones, mascotas…)</span>
              <textarea name="politicas" rows="4" maxlength="4000" [(ngModel)]="x.politicas"></textarea>
              <span class="contador">{{ (x.politicas ?? '').length }} / 4000</span>
              @if (envio.campo('politicas'); as m) { <span class="msg">{{ m }}</span> }
            </label>
          }
          <p class="suave chico">La descripción corta en español es obligatoria para enviar a revisión. El inglés es opcional; si falta, el sitio muestra el español.</p>
        </div>
      </fieldset>

      <div class="acciones">
        <button type="submit" class="boton" [disabled]="envio.trabajando() || soloLectura()">{{ envio.trabajando() ? 'Guardando…' : 'Guardar descripción' }}</button>
      </div>
      <app-estado-guardado [envio]="envio" />
    </form>
  `,
  styles: `
    :host { display: contents; }
    form { display: grid; gap: 14px; }
  `,
})
export class SeccionDescripcion {
  private readonly api = inject(Api);
  readonly ficha = input.required<Ficha>();
  readonly soloLectura = input(false);
  readonly guardado = output<ResultadoCambio>();

  protected readonly envio = new Envio();
  protected readonly actual = signal('es');
  private readonly textos = signal<Record<string, Traduccion>>({ es: VACIA(), en: VACIA() });
  protected readonly t = computed(() => this.textos()[this.actual()] ?? null);
  /** Español e inglés siempre; otros idiomas solo si la ficha ya tiene texto en ellos. */
  protected readonly idiomas = computed(() => Object.keys(this.textos()));
  protected readonly nombre = (c: string): string => NOMBRES[c] ?? c.toUpperCase();

  constructor() {
    effect(() => {
      const guardadas = this.ficha().traducciones ?? {};
      const base: Record<string, Traduccion> = { es: VACIA(), en: VACIA() };
      for (const [c, v] of Object.entries(guardadas)) {
        base[c] = { descripcionCorta: v.descripcionCorta ?? '', descripcion: v.descripcion ?? '', politicas: v.politicas ?? '' };
      }
      this.textos.set(base);
    });
  }

  protected errorCorta(): string | null {
    return this.envio.campo('es.descripcionCorta') ?? this.envio.campo('descripcionCorta');
  }

  protected guardar(): void {
    const cuerpo: Record<string, Traduccion> = {};
    for (const [c, v] of Object.entries(this.textos())) {
      const limpio: Traduccion = { descripcionCorta: vacioANull(v.descripcionCorta), descripcion: vacioANull(v.descripcion), politicas: vacioANull(v.politicas) };
      const hayTexto = !!(limpio.descripcionCorta || limpio.descripcion || limpio.politicas);
      const yaExistia = !!this.ficha().traducciones?.[c];
      // El español siempre se manda; los demás idiomas solo si tienen texto o ya existían (así se pueden vaciar).
      if (c === 'es' || hayTexto || yaExistia) cuerpo[c] = limpio;
    }
    this.envio.ejecutar(this.api.guardarTraducciones(this.ficha().id, cuerpo), (r) => this.guardado.emit(r));
  }
}
