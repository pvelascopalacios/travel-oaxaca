import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, DatosNegocio } from '../../core/api';
import { CampoAtributo, aNumero, camposDeRaiz, limpiarAtributos, raizDeCategoria, vacioANull } from '../../core/edicion';
import { Envio } from '../../core/envio';
import { Categoria, Ficha, Idioma, ResultadoCambio } from '../../core/modelos';
import { OpcionCategoria, categoriasElegibles } from '../../core/portal';
import { EstadoGuardado } from '../../shared/estado-guardado';

interface Formulario {
  nombreComercial: string;
  razonSocial: string;
  categoriaId: string;
  rangoPrecio: string;
  precioDesde: string;
  unidadPrecio: string;
  /** Un valor por clave de atributo: texto, lista, sí/no… según el campo. */
  atributos: Record<string, unknown>;
}

const RANGOS = [
  { valor: '', texto: 'Sin indicar' },
  { valor: '1', texto: '$ · Económico' },
  { valor: '2', texto: '$$ · Moderado' },
  { valor: '3', texto: '$$$ · Alto' },
  { valor: '4', texto: '$$$$ · Muy alto' },
];

const UNIDADES = [
  { valor: '', texto: 'Sin indicar' },
  { valor: 'por_persona', texto: 'por persona' },
  { valor: 'por_noche', texto: 'por noche' },
  { valor: 'por_grupo', texto: 'por grupo' },
];

/** Datos del negocio y los datos propios de su tipo (hospedaje, comida, tours…). */
@Component({
  selector: 'app-seccion-datos',
  imports: [FormsModule, EstadoGuardado],
  template: `
    <form (ngSubmit)="guardar()" novalidate>
      <fieldset class="bloque" [disabled]="soloLectura()">
        <div class="tarjeta">
          <h2>Datos del negocio</h2>
          <div class="campos">
            <label [class.error]="envio.campo('nombreComercial')">Nombre comercial
              <input type="text" name="nombre" maxlength="150" [(ngModel)]="f().nombreComercial" />
              @if (envio.campo('nombreComercial'); as m) { <span class="msg">{{ m }}</span> }
            </label>
            <label [class.error]="envio.campo('razonSocial')">Razón social <span class="ayuda">(opcional, no se publica)</span>
              <input type="text" name="razon" maxlength="200" [(ngModel)]="f().razonSocial" />
              @if (envio.campo('razonSocial'); as m) { <span class="msg">{{ m }}</span> }
            </label>
            <label [class.error]="envio.campo('categoriaId')">Categoría
              <select name="categoria" [ngModel]="f().categoriaId" (ngModelChange)="cambiarCategoria($event)">
                @for (c of opciones(); track c.id) { <option [value]="c.id">{{ c.etiqueta }}</option> }
              </select>
              @if (envio.campo('categoriaId'); as m) { <span class="msg">{{ m }}</span> }
            </label>
            <label [class.error]="envio.campo('rangoPrecio')">Rango de precio
              <select name="rango" [(ngModel)]="f().rangoPrecio">
                @for (r of rangos; track r.valor) { <option [value]="r.valor">{{ r.texto }}</option> }
              </select>
              @if (envio.campo('rangoPrecio'); as m) { <span class="msg">{{ m }}</span> }
            </label>
            <label [class.error]="envio.campo('precioDesde')">Precio desde (MXN)
              <input type="text" inputmode="decimal" name="precio" maxlength="10" [(ngModel)]="f().precioDesde" />
              @if (envio.campo('precioDesde'); as m) { <span class="msg">{{ m }}</span> }
            </label>
            <label [class.error]="envio.campo('unidadPrecio')">Unidad del precio
              <select name="unidad" [(ngModel)]="f().unidadPrecio">
                @for (u of unidades; track u.valor) { <option [value]="u.valor">{{ u.texto }}</option> }
              </select>
              @if (envio.campo('unidadPrecio'); as m) { <span class="msg">{{ m }}</span> }
            </label>
          </div>
        </div>

        @if (campos().length) {
          <div class="tarjeta">
            <h2>Datos de tu tipo de negocio <span class="etiqueta">{{ nombreRaiz() }}</span></h2>
            <div class="campos">
              @for (c of campos(); track c.clave) {
                <div class="campo" [class.ancho]="c.tipo === 'etiquetas' || c.tipo === 'multi' || c.tipo === 'idiomas'">
                  @switch (c.tipo) {
                    @case ('texto') {
                      <label [class.error]="errorAtributo(c)">{{ c.etiqueta }} @if (c.ayuda) { <span class="ayuda">({{ c.ayuda }})</span> }
                        <input type="text" [name]="c.clave" [attr.maxlength]="c.max" [ngModel]="texto(c)" (ngModelChange)="poner(c, $event)" />
                        @if (errorAtributo(c); as m) { <span class="msg">{{ m }}</span> }
                      </label>
                    }
                    @case ('numero') {
                      <label [class.error]="errorAtributo(c)">{{ c.etiqueta }}
                        <input type="text" inputmode="decimal" [name]="c.clave" maxlength="6" [ngModel]="texto(c)" (ngModelChange)="poner(c, numero($event))" />
                        @if (errorAtributo(c); as m) { <span class="msg">{{ m }}</span> }
                      </label>
                    }
                    @case ('entero') {
                      <label [class.error]="errorAtributo(c)">{{ c.etiqueta }}
                        <input type="text" inputmode="numeric" [name]="c.clave" maxlength="5" [ngModel]="texto(c)" (ngModelChange)="poner(c, entero($event))" />
                        @if (errorAtributo(c); as m) { <span class="msg">{{ m }}</span> }
                      </label>
                    }
                    @case ('hora') {
                      <label [class.error]="errorAtributo(c)">{{ c.etiqueta }}
                        <input type="time" [name]="c.clave" [ngModel]="texto(c)" (ngModelChange)="poner(c, $event)" />
                        @if (errorAtributo(c); as m) { <span class="msg">{{ m }}</span> }
                      </label>
                    }
                    @case ('sino') {
                      <label [class.error]="errorAtributo(c)">{{ c.etiqueta }}
                        <select [name]="c.clave" [ngModel]="sino(c)" (ngModelChange)="poner(c, $event === '' ? null : $event === 'si')">
                          <option value="">Sin indicar</option><option value="si">Sí</option><option value="no">No</option>
                        </select>
                        @if (errorAtributo(c); as m) { <span class="msg">{{ m }}</span> }
                      </label>
                    }
                    @case ('opcion') {
                      <label [class.error]="errorAtributo(c)">{{ c.etiqueta }}
                        <select [name]="c.clave" [ngModel]="texto(c)" (ngModelChange)="poner(c, opcion(c, $event))">
                          <option value="">Sin indicar</option>
                          @for (o of c.opciones; track o.valor) { <option [value]="o.valor">{{ o.texto }}</option> }
                        </select>
                        @if (errorAtributo(c); as m) { <span class="msg">{{ m }}</span> }
                      </label>
                    }
                    @case ('multi') {
                      <div role="group" [attr.aria-label]="c.etiqueta">
                        <strong class="rotulo">{{ c.etiqueta }}</strong>
                        <div class="chips">
                          @for (o of c.opciones; track o.valor) {
                            <button type="button" class="chip" [attr.aria-pressed]="lista(c).includes('' + o.valor)" (click)="alternar(c, '' + o.valor)">{{ o.texto }}</button>
                          }
                        </div>
                        @if (errorAtributo(c); as m) { <span class="msg">{{ m }}</span> }
                      </div>
                    }
                    @case ('idiomas') {
                      <div role="group" [attr.aria-label]="c.etiqueta">
                        <strong class="rotulo">{{ c.etiqueta }}</strong>
                        <div class="chips">
                          @for (i of idiomas(); track i.codigo) {
                            <button type="button" class="chip" [attr.aria-pressed]="lista(c).includes(i.codigo)" (click)="alternar(c, i.codigo)">{{ i.nombre }}</button>
                          }
                        </div>
                        @if (errorAtributo(c); as m) { <span class="msg">{{ m }}</span> }
                      </div>
                    }
                    @case ('etiquetas') {
                      <div role="group" [attr.aria-label]="c.etiqueta">
                        <strong class="rotulo">{{ c.etiqueta }}</strong> @if (c.ayuda) { <span class="ayuda">{{ c.ayuda }}</span> }
                        <div class="chips">
                          @for (t of lista(c); track t) {
                            <button type="button" class="chip quitable" aria-pressed="true" [attr.aria-label]="'Quitar ' + t" (click)="quitarEtiqueta(c, t)">{{ t }}</button>
                          }
                        </div>
                        @if (lista(c).length < (c.tope ?? 10)) {
                          <div class="agregar">
                            <input type="text" [name]="'nueva-' + c.clave" [attr.maxlength]="c.max" placeholder="Escribe y presiona Agregar" [ngModel]="nueva()[c.clave] ?? ''" (ngModelChange)="escribirNueva(c, $event)" (keydown.enter)="$event.preventDefault(); agregarEtiqueta(c)" />
                            <button type="button" class="boton secundario" (click)="agregarEtiqueta(c)">Agregar</button>
                          </div>
                        }
                        @if (errorAtributo(c); as m) { <span class="msg">{{ m }}</span> }
                      </div>
                    }
                  }
                </div>
              }
            </div>
          </div>
        }
      </fieldset>

      <div class="acciones">
        <button type="submit" class="boton" [disabled]="envio.trabajando() || soloLectura()">{{ envio.trabajando() ? 'Guardando…' : 'Guardar datos' }}</button>
      </div>
      <app-estado-guardado [envio]="envio" />
    </form>
  `,
  styles: `
    :host { display: contents; }
    form { display: grid; gap: 14px; }
    .campo { min-width: 0; display: grid; gap: 6px; }
    .rotulo { font-size: 0.88rem; }
    .agregar { display: flex; gap: 8px; margin-top: 8px; input { max-width: 320px; } }
  `,
})
export class SeccionDatos {
  private readonly api = inject(Api);
  readonly ficha = input.required<Ficha>();
  readonly arbol = input.required<Categoria[]>();
  readonly idiomas = input.required<Idioma[]>();
  readonly soloLectura = input(false);
  readonly guardado = output<ResultadoCambio>();

  protected readonly envio = new Envio();
  protected readonly rangos = RANGOS;
  protected readonly unidades = UNIDADES;
  protected readonly f = signal<Formulario>({ nombreComercial: '', razonSocial: '', categoriaId: '', rangoPrecio: '', precioDesde: '', unidadPrecio: '', atributos: {} });
  protected readonly nueva = signal<Record<string, string>>({});

  protected readonly opciones = computed<OpcionCategoria[]>(() => categoriasElegibles(this.arbol()));
  private readonly raiz = computed(() => raizDeCategoria(this.arbol(), this.f().categoriaId));
  protected readonly campos = computed(() => camposDeRaiz(this.raiz()));
  protected readonly nombreRaiz = computed(() => this.arbol().find((c) => c.clave === this.raiz())?.nombre ?? '');

  constructor() {
    // Cada vez que llega la ficha (al cargar o después de guardar) el formulario se llena con lo que quedó guardado.
    effect(() => this.llenar(this.ficha()));
  }

  private llenar(x: Ficha): void {
    this.f.set({
      nombreComercial: x.nombreComercial,
      razonSocial: x.razonSocial ?? '',
      categoriaId: x.categoriaId,
      rangoPrecio: x.rangoPrecio ? String(x.rangoPrecio) : '',
      precioDesde: x.precioDesde !== null && x.precioDesde !== undefined ? String(x.precioDesde) : '',
      unidadPrecio: x.unidadPrecio ?? '',
      atributos: { ...(x.atributos ?? {}) },
    });
    this.nueva.set({});
  }

  protected cambiarCategoria(id: string): void {
    const antes = this.raiz();
    this.f.update((x) => ({ ...x, categoriaId: id }));
    // Los datos propios de otro tipo de negocio no aplican: se limpian al cambiar de tipo.
    if (this.raiz() !== antes) this.f.update((x) => ({ ...x, atributos: {} }));
  }

  // ---- lectura y escritura de cada atributo ----
  protected texto(c: CampoAtributo): string {
    const v = this.f().atributos[c.clave];
    return v === null || v === undefined ? '' : String(v);
  }
  protected sino(c: CampoAtributo): string {
    const v = this.f().atributos[c.clave];
    return v === true ? 'si' : v === false ? 'no' : '';
  }
  protected lista(c: CampoAtributo): string[] {
    const v = this.f().atributos[c.clave];
    return Array.isArray(v) ? (v as string[]) : [];
  }
  protected poner(c: CampoAtributo, valor: unknown): void {
    this.f.update((x) => ({ ...x, atributos: { ...x.atributos, [c.clave]: valor } }));
  }
  protected numero(t: string): number | string {
    return aNumero(t) ?? t.trim();
  }
  protected entero(t: string): number | string {
    const n = aNumero(t);
    return n !== null && Number.isInteger(n) ? n : t.trim();
  }
  protected opcion(c: CampoAtributo, t: string): string | number | null {
    if (t === '') return null;
    const o = c.opciones?.find((x) => String(x.valor) === t);
    return o ? o.valor : t;
  }
  protected alternar(c: CampoAtributo, valor: string): void {
    const actual = this.lista(c);
    const siguiente = actual.includes(valor) ? actual.filter((x) => x !== valor) : [...actual, valor];
    if (siguiente.length > (c.tope ?? 20)) return;
    this.poner(c, siguiente);
  }
  protected escribirNueva(c: CampoAtributo, t: string): void {
    this.nueva.update((n) => ({ ...n, [c.clave]: t }));
  }
  protected agregarEtiqueta(c: CampoAtributo): void {
    const t = (this.nueva()[c.clave] ?? '').trim();
    if (!t || this.lista(c).includes(t) || this.lista(c).length >= (c.tope ?? 10)) return;
    this.poner(c, [...this.lista(c), t]);
    this.escribirNueva(c, '');
  }
  protected quitarEtiqueta(c: CampoAtributo, t: string): void {
    this.poner(c, this.lista(c).filter((x) => x !== t));
  }
  protected errorAtributo(c: CampoAtributo): string | null {
    return this.envio.campo('atributos.' + c.clave);
  }

  protected guardar(): void {
    const x = this.f();
    const campos: Record<string, string> = {};
    if (!x.nombreComercial.trim()) campos['nombreComercial'] = 'Escribe el nombre del negocio.';
    if (!x.categoriaId) campos['categoriaId'] = 'Elige una categoría.';
    const precio = aNumero(x.precioDesde);
    if (x.precioDesde.trim() && precio === null) campos['precioDesde'] = 'Escribe solo números, por ejemplo 90.';
    if (Object.keys(campos).length) {
      this.envio.fallar('Revisa los datos marcados.', campos);
      return;
    }
    const cuerpo: DatosNegocio = {
      nombreComercial: x.nombreComercial.trim(),
      razonSocial: vacioANull(x.razonSocial),
      categoriaId: x.categoriaId,
      rangoPrecio: x.rangoPrecio ? Number(x.rangoPrecio) : null,
      precioDesde: precio,
      unidadPrecio: x.unidadPrecio || null,
      atributos: limpiarAtributos(this.raiz(), x.atributos),
    };
    this.envio.ejecutar(this.api.actualizarNegocio(this.ficha().id, cuerpo), (r) => this.guardado.emit(r));
  }
}
