import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Api } from '../../core/api';
import { Oferta, Respuesta } from '../../core/modelos';
import {
  FormOferta, IDIOMAS_OPCION, articuloNuevo, MARCAS, SECCIONES_MENU, UNIDADES, errorDeOferta, formDeOferta, formVacio, nombreTipo, nombreTipoNuevo, ofertaParaApi,
  unidadesDeTipo, usaCapacidad, usaDuracion, usaIncluye, usaMenu,
} from '../../core/opciones';
import { leerError } from '../../core/portal';

export interface OpcionGuardada {
  oferta: Oferta;
  /** Qué pasó si algo quedó a medias (por ejemplo, se guardó pero no se pudo publicar). */
  aviso: string | null;
}

/** Formulario de una opción (platillo, habitación, tour, experiencia o producto): crear o cambiar. */
@Component({
  selector: 'app-form-opcion',
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="guardar(false)" novalidate>
      <div class="tarjeta">
        <div class="fila-cab">
          <h2>{{ oferta() ? 'Cambiar ' + nombreNuevo(f().tipo) : articulo(f().tipo) + ' ' + nombreNuevo(f().tipo) }}</h2>
          <div class="segmento" role="group" aria-label="Idioma">
            @for (i of idiomasOpcion; track i.codigo) {
              <button type="button" [attr.aria-pressed]="idioma() === i.codigo" (click)="idioma.set(i.codigo)">{{ i.texto }}@if (idiomaConError(i.codigo)) { <span class="marca-error" aria-label="con errores"> !</span> }</button>
            }
          </div>
        </div>

        @if (tipos().length > 1 && !oferta()) {
          <div class="segmento" role="group" aria-label="Tipo de opción">
            @for (t of tipos(); track t) {
              <button type="button" [attr.aria-pressed]="f().tipo === t" (click)="cambiarTipo(t)">{{ nombreTipo(t) }}</button>
            }
          </div>
        }

        @if (general(); as g) { <p class="aviso" role="alert">{{ g }}</p> }

        @if (texto(); as x) {
          <label [class.error]="err('traducciones.' + idioma() + '.nombre')">Nombre @if (idioma() === 'es') { <span class="ayuda">(obligatorio en español)</span> } @else { <span class="ayuda">(opcional)</span> }
            <input type="text" name="nombre" maxlength="150" [(ngModel)]="x.nombre" />
            <span class="contador">{{ x.nombre.length }} / 150</span>
            @if (err('traducciones.' + idioma() + '.nombre'); as m) { <span class="msg">{{ m }}</span> }
          </label>
          <label [class.error]="err('traducciones.' + idioma() + '.descripcion')">Descripción <span class="ayuda">(opcional)</span>
            <textarea name="descripcion" rows="3" maxlength="4000" [(ngModel)]="x.descripcion"></textarea>
            @if (err('traducciones.' + idioma() + '.descripcion'); as m) { <span class="msg">{{ m }}</span> }
          </label>
          @if (conIncluye()) {
            <div class="campos">
              <label [class.error]="err('traducciones.' + idioma() + '.incluye')">Incluye
                <textarea name="incluye" rows="3" maxlength="2000" [(ngModel)]="x.incluye" placeholder="Desayuno · Wi-Fi · Agua caliente"></textarea>
                @if (err('traducciones.' + idioma() + '.incluye'); as m) { <span class="msg">{{ m }}</span> }
              </label>
              <label [class.error]="err('traducciones.' + idioma() + '.noIncluye')">No incluye
                <textarea name="noincluye" rows="3" maxlength="2000" [(ngModel)]="x.noIncluye"></textarea>
                @if (err('traducciones.' + idioma() + '.noIncluye'); as m) { <span class="msg">{{ m }}</span> }
              </label>
            </div>
          }
        }

        <div class="campos">
          @if (conMenu()) {
            <label [class.error]="err('seccion')">Sección del menú
              <select name="seccion" [(ngModel)]="f().seccion">
                @for (s of secciones; track s.clave) { <option [value]="s.clave">{{ s.texto }}</option> }
              </select>
              @if (err('seccion'); as m) { <span class="msg">{{ m }}</span> }
            </label>
          }
          <label [class.error]="err('precioDesde')">Precio desde (MXN) <span class="ayuda">(opcional)</span>
            <input type="text" name="precio" inputmode="decimal" [(ngModel)]="f().precio" />
            @if (err('precioDesde'); as m) { <span class="msg">{{ m }}</span> }
          </label>
          <label [class.error]="err('unidadPrecio')">Unidad
            <select name="unidad" [(ngModel)]="f().unidad">
              <option value="">Sin unidad</option>
              @for (u of unidades(); track u) { <option [value]="u">{{ nombreUnidad(u) }}</option> }
            </select>
            @if (err('unidadPrecio'); as m) { <span class="msg">{{ m }}</span> }
          </label>
          @if (conCapacidad()) {
            <label [class.error]="err('capacidad')">{{ f().tipo === 'habitacion' ? 'Capacidad (personas)' : 'Máximo de personas' }} <span class="ayuda">(opcional)</span>
              <input type="text" name="capacidad" inputmode="numeric" [(ngModel)]="f().capacidad" />
              @if (err('capacidad'); as m) { <span class="msg">{{ m }}</span> }
            </label>
          }
          @if (conDuracion()) {
            <div class="duracion" [class.error]="err('duracionMin')">
              <span class="etq">Duración <span class="ayuda">(opcional)</span></span>
              <span class="fila-d">
                <label class="corta">Horas <input type="text" name="horas" inputmode="numeric" [(ngModel)]="f().horas" /></label>
                <label class="corta">Minutos <input type="text" name="minutos" inputmode="numeric" [(ngModel)]="f().minutos" /></label>
              </span>
              @if (err('duracionMin'); as m) { <span class="msg">{{ m }}</span> }
            </div>
          }
        </div>

        @if (conMenu()) {
          <div class="grupo" [class.error]="err('etiquetas')">
            <span class="etq">Marcas <span class="ayuda">(hasta 3)</span></span>
            <div class="chips" role="group" aria-label="Marcas">
              @for (m of marcas; track m.clave) {
                <button type="button" class="chip" [attr.aria-pressed]="f().etiquetas.includes(m.clave)" (click)="alternarMarca(m.clave)">{{ m.texto }}</button>
              }
            </div>
            @if (err('etiquetas'); as m) { <span class="msg">{{ m }}</span> }
          </div>
        }
      </div>

      <div class="acciones">
        @if (oferta()) {
          <button type="submit" class="boton" [disabled]="trabajando()">{{ trabajando() ? 'Guardando…' : 'Guardar cambios' }}</button>
        } @else {
          <button type="button" class="boton" [disabled]="trabajando()" (click)="guardar(true)">{{ trabajando() ? 'Guardando…' : 'Guardar y publicar' }}</button>
          <button type="submit" class="boton sec" [disabled]="trabajando()">Guardar como borrador</button>
        }
        <button type="button" class="enlace" [disabled]="trabajando()" (click)="cancelar.emit()">Cancelar</button>
      </div>
    </form>
  `,
  styles: `
    :host { display: contents; }
    form { display: grid; gap: 14px; }
    .acciones { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .marca-error { color: var(--grana); font-weight: 800; }
    [aria-pressed='true'] .marca-error { color: #fff; }
    .duracion { display: grid; gap: 6px; font-weight: 600; font-size: 0.88rem; }
    .fila-d { display: flex; gap: 10px; }
    .corta { flex: 1; min-width: 0; font-weight: 400; }
    .grupo { display: grid; gap: 8px; font-weight: 600; font-size: 0.88rem; }
    .duracion.error input { border-color: var(--grana); }
  `,
})
export class FormOpcion implements OnInit {
  private readonly api = inject(Api);
  readonly negocioId = input.required<string>();
  /** Tipos que admite la categoría del negocio (uno o, en tours, dos). */
  readonly tipos = input.required<string[]>();
  /** Opción que se cambia; vacío = nueva. */
  readonly oferta = input<Oferta | null>(null);
  /** Lugar que ocupará una opción nueva. */
  readonly ordenNuevo = input(0);
  readonly guardada = output<OpcionGuardada>();
  readonly cancelar = output<void>();

  protected readonly f = signal<FormOferta>(formVacio('platillo'));
  protected readonly idioma = signal('es');
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly general = signal<string | null>(null);
  protected readonly trabajando = signal(false);

  protected readonly idiomasOpcion = IDIOMAS_OPCION;
  protected readonly secciones = SECCIONES_MENU;
  protected readonly marcas = MARCAS;
  protected readonly nombreTipo = nombreTipo;
  protected readonly nombreNuevo = nombreTipoNuevo;
  protected readonly articulo = articuloNuevo;
  protected readonly nombreUnidad = (u: string): string => UNIDADES[u] ?? u;

  protected readonly texto = computed(() => this.f().textos[this.idioma()] ?? null);
  protected readonly unidades = computed(() => {
    const base = unidadesDeTipo(this.f().tipo);
    const actual = this.f().unidad;
    return actual && !base.includes(actual) ? [...base, actual] : base;
  });
  protected readonly conIncluye = computed(() => usaIncluye(this.f().tipo));
  protected readonly conMenu = computed(() => usaMenu(this.f().tipo));
  protected readonly conCapacidad = computed(() => usaCapacidad(this.f().tipo));
  protected readonly conDuracion = computed(() => usaDuracion(this.f().tipo));

  ngOnInit(): void {
    const o = this.oferta();
    this.f.set(o ? formDeOferta(o) : formVacio(this.tipos()[0] ?? 'platillo', this.ordenNuevo()));
  }

  protected cambiarTipo(t: string): void {
    // Al pasar de tour a experiencia se conserva lo escrito; solo cambia lo que depende del tipo.
    this.f.update((x) => ({ ...x, tipo: t, unidad: unidadesDeTipo(t).includes(x.unidad) ? x.unidad : unidadesDeTipo(t)[0] }));
  }

  protected alternarMarca(c: string): void {
    this.f.update((x) => ({ ...x, etiquetas: x.etiquetas.includes(c) ? x.etiquetas.filter((e) => e !== c) : [...x.etiquetas, c] }));
  }

  protected err(clave: string): string | null {
    return this.errores()[clave] ?? null;
  }

  protected idiomaConError(c: string): boolean {
    return Object.keys(this.errores()).some((k) => k.startsWith(`traducciones.${c}.`));
  }

  protected guardar(publicar: boolean): void {
    if (this.trabajando()) return;
    const locales = errorDeOferta(this.f());
    this.errores.set(locales);
    this.general.set(null);
    if (Object.keys(locales).length) {
      this.general.set('Revisa los campos marcados.');
      // Si el error está en el otro idioma, se muestra ese.
      const k = Object.keys(locales).find((x) => x.startsWith('traducciones.'));
      if (k && !this.idiomaConError(this.idioma())) this.idioma.set(k.split('.')[1]);
      return;
    }
    const cuerpo = ofertaParaApi(this.f());
    const o = this.oferta();
    this.trabajando.set(true);
    const llamada: Observable<Respuesta<Oferta>> = o ? this.api.actualizarOferta(this.negocioId(), o.id, cuerpo) : this.api.crearOferta(this.negocioId(), cuerpo);
    llamada.subscribe({
      next: (r) => {
        if (!publicar || o) {
          this.trabajando.set(false);
          this.guardada.emit({ oferta: r.datos, aviso: null });
          return;
        }
        // Nueva y «publicar»: la API la crea como borrador, así que se cambia el estado en un segundo paso.
        this.api.estadoOferta(this.negocioId(), r.datos.id, 'publicada').subscribe({
          next: (x) => {
            this.trabajando.set(false);
            this.guardada.emit({ oferta: x.datos, aviso: null });
          },
          error: (e) => {
            this.trabajando.set(false);
            this.guardada.emit({ oferta: r.datos, aviso: 'Se guardó como borrador, pero no se pudo publicar: ' + (leerError(e).general ?? 'inténtalo de nuevo.') });
          },
        });
      },
      error: (e) => {
        this.trabajando.set(false);
        const x = leerError(e);
        this.errores.set(x.campos);
        this.general.set(x.general ?? 'Revisa los campos marcados.');
        const k = Object.keys(x.campos).find((c) => c.startsWith('traducciones.'));
        if (k && !this.idiomaConError(this.idioma())) this.idioma.set(k.split('.')[1]);
      },
    });
  }
}
