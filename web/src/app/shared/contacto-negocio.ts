import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { MAX_MENSAJE_CONTACTO, ErroresContacto, hayErroresContacto, mensajeFinal, municipioElegido, opcionesCategoria, validarContacto } from '../core/contacto';
import { ErrorApi, leerError } from '../core/cuenta';
import { I18n } from '../core/i18n';
import { Categoria, MunicipioOpcion } from '../core/modelos';

/** «Quiero que me contacten»: un dueño de negocio deja sus datos sin crear cuenta y queda como prospecto. */
@Component({
  selector: 'app-contacto-negocio',
  imports: [FormsModule, RouterLink],
  template: `
    <section class="contacto" id="contacto" aria-labelledby="ct-t">
      @if (enviado()) {
        <div class="gracias" role="status">
          <h2 id="ct-t">{{ nombreGracias() ? i18n.tf('ctGracias', { nombre: nombreGracias() }) : i18n.t('ctGraciasSin') }}</h2>
          <p>{{ i18n.t('ctGraciasTexto') }}</p>
        </div>
      } @else {
        <h2 id="ct-t">{{ i18n.t('ctTitulo') }}</h2>
        <p class="suave">{{ i18n.t('ctTexto') }}</p>
        <form (ngSubmit)="enviar()" novalidate>
          <div class="rejilla">
            <label>
              <span>{{ i18n.t('ctNegocio') }} <b class="req">*</b></span>
              <input type="text" name="nombreNegocio" maxlength="160" autocomplete="organization" [(ngModel)]="nombreNegocio" [class.mal]="!!campo('nombreNegocio')" />
              @if (campo('nombreNegocio'); as m) { <small class="err" role="alert">{{ m }}</small> }
            </label>
            <label>
              <span>{{ i18n.t('ctTuNombre') }}</span>
              <input type="text" name="contactoNombre" maxlength="120" autocomplete="name" [(ngModel)]="contactoNombre" />
            </label>
            <label>
              <span>{{ i18n.t('ctCategoria') }}</span>
              <select name="categoriaId" [(ngModel)]="categoriaId">
                <option value="">—</option>
                @for (g of categorias(); track $index) {
                  @if (g.grupo) {
                    <optgroup [label]="g.grupo">
                      @for (c of g.items; track c.id) { <option [value]="c.id">{{ c.nombre }}</option> }
                    </optgroup>
                  } @else {
                    @for (c of g.items; track c.id) { <option [value]="c.id">{{ c.nombre }}</option> }
                  }
                }
              </select>
            </label>
            <label>
              <span>{{ i18n.t('ctMunicipio') }}</span>
              <input type="text" name="municipio" maxlength="80" list="ct-municipios" autocomplete="off" [(ngModel)]="municipioTexto" (ngModelChange)="buscarMunicipios($event)" />
              <datalist id="ct-municipios">
                @for (m of sugerencias(); track m.id) { <option [value]="m.nombre"></option> }
              </datalist>
            </label>
            <label>
              <span>{{ i18n.t('ctTelefono') }}</span>
              <input type="tel" name="telefono" maxlength="30" autocomplete="tel" inputmode="tel" [(ngModel)]="telefono" [class.mal]="!!campo('telefono') || !!errores().contacto" />
              @if (campo('telefono'); as m) { <small class="err" role="alert">{{ m }}</small> }
            </label>
            <label>
              <span>{{ i18n.t('ctCorreo') }}</span>
              <input type="email" name="correo" maxlength="160" autocomplete="email" [(ngModel)]="correo" [class.mal]="!!campo('correo') || !!errores().contacto" />
              @if (campo('correo'); as m) { <small class="err" role="alert">{{ m }}</small> }
            </label>
          </div>
          @if (errores().contacto) { <small class="err" role="alert">{{ i18n.t(errores().contacto!) }}</small> }
          <label>
            <span>{{ i18n.t('ctMensaje') }}</span>
            <textarea name="mensaje" rows="3" [maxLength]="max" [(ngModel)]="mensaje"></textarea>
            @if (errores().mensaje) { <small class="err" role="alert">{{ i18n.t(errores().mensaje!) }}</small> }
          </label>
          <div class="trampa" aria-hidden="true">
            <label>Sitio web <input type="text" name="sitioWeb" tabindex="-1" autocomplete="off" [(ngModel)]="sitioWeb" /></label>
          </div>
          @if (error().general) { <p class="aviso-error" role="alert">{{ error().general }}</p> }
          <p class="suave chico">{{ i18n.t('ctPrivacidadPre') }} <a [routerLink]="['/', i18n.lang(), 'privacidad']">{{ i18n.t('ctPrivacidadEnlace') }}</a>.</p>
          <button type="submit" class="boton" [disabled]="enviando()">{{ i18n.t('ctEnviar') }}</button>
        </form>
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .contacto { display: grid; gap: 12px; max-width: 760px; margin-inline: auto; padding: 22px; border: 1px solid var(--linea); border-radius: 16px; background: var(--papel); }
    h2 { margin: 0; font: 700 1.4rem var(--fuente-titulo); }
    p { margin: 0; }
    .suave { color: var(--tinta-suave); }
    .chico { font-size: 0.86rem; }
    form { display: grid; gap: 12px; }
    .rejilla { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
    label { display: grid; gap: 4px; min-width: 0; font-weight: 600; font-size: 0.9rem; }
    input, select, textarea { width: 100%; box-sizing: border-box; min-height: 44px; padding: 10px 12px; border: 1px solid var(--linea); border-radius: 10px; background: var(--fondo); color: var(--tinta); font: inherit; font-weight: 400; }
    .mal { border-color: var(--grana); }
    .req { color: var(--grana); }
    .err { color: var(--grana); font-weight: 400; }
    .trampa { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
    .gracias { display: grid; gap: 8px; padding: 6px 0; }
    form .boton { width: fit-content; }
  `,
})
export class ContactoNegocio implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);

  protected readonly max = MAX_MENSAJE_CONTACTO;
  protected readonly categorias = signal<{ grupo: string | null; items: { id: string; nombre: string }[] }[]>([]);
  protected readonly sugerencias = signal<MunicipioOpcion[]>([]);
  protected readonly errores = signal<ErroresContacto>({});
  protected readonly error = signal<ErrorApi>({ general: null, campos: {} });
  protected readonly enviando = signal(false);
  protected readonly enviado = signal(false);
  protected readonly nombreGracias = signal('');

  protected nombreNegocio = '';
  protected contactoNombre = '';
  protected categoriaId = '';
  protected municipioTexto = '';
  protected telefono = '';
  protected correo = '';
  protected mensaje = '';
  protected sitioWeb = '';
  private pendiente: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    this.api.categorias().subscribe({ next: (c: Categoria[]) => this.categorias.set(opcionesCategoria(c)), error: () => undefined });
  }

  /** Mensaje de un campo: primero lo que revisó la página y, si no, lo que respondió la API. */
  protected campo(n: 'nombreNegocio' | 'telefono' | 'correo'): string | null {
    const local = n === 'nombreNegocio' ? this.errores().nombreNegocio : null;
    return (local ? this.i18n.t(local) : null) ?? this.error().campos[n] ?? null;
  }

  protected buscarMunicipios(texto: string): void {
    clearTimeout(this.pendiente);
    const q = texto.trim();
    if (q.length < 2) {
      this.sugerencias.set([]);
      return;
    }
    this.pendiente = setTimeout(() => this.api.municipios(q).subscribe({ next: (l) => this.sugerencias.set(l), error: () => undefined }), 250);
  }

  protected enviar(): void {
    if (this.enviando()) return;
    this.error.set({ general: null, campos: {} });
    const e = validarContacto({ nombreNegocio: this.nombreNegocio, contactoNombre: this.contactoNombre, telefono: this.telefono, correo: this.correo, mensaje: this.mensaje, municipioTexto: this.municipioTexto });
    this.errores.set(e);
    if (hayErroresContacto(e)) return;
    const municipio = municipioElegido(this.municipioTexto, this.sugerencias());
    this.enviando.set(true);
    this.api
      .solicitarContacto({
        nombreNegocio: this.nombreNegocio.trim(),
        contactoNombre: this.contactoNombre.trim() || null,
        categoriaId: this.categoriaId || null,
        municipioId: municipio?.id ?? null,
        telefono: this.telefono.trim() || null,
        correo: this.correo.trim() || null,
        mensaje: mensajeFinal(this.mensaje, this.municipioTexto, municipio),
        sitioWeb: this.sitioWeb,
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.nombreGracias.set(this.contactoNombre.trim().split(/\s+/)[0] ?? '');
          this.enviado.set(true);
        },
        error: (err) => {
          this.enviando.set(false);
          this.error.set(leerError(err, this.i18n.t('ctError')));
        },
      });
  }
}
