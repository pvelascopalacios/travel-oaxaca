import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { FormPromo, TIPOS_PROMO, errorDePromo, formDePromo, formVacioPromo, hoyIso, insignia, periodoTexto, promoParaApi, usaValor } from '../../core/comercial';
import { aNumero } from '../../core/edicion';
import { Oferta, Promocion } from '../../core/modelos';
import { nombreDe } from '../../core/opciones';
import { leerError } from '../../core/portal';

export interface PromoGuardada {
  promo: Promocion;
  /** Qué pasó si algo quedó a medias (se guardó pero no se pudo enviar a revisión). */
  aviso: string | null;
}

/** Formulario de una promoción: crear o cambiar un borrador, y opcionalmente enviarla a revisión. */
@Component({
  selector: 'app-form-promocion',
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="guardar(false)" novalidate>
      <div class="tarjeta">
        <div class="fila-cab">
          <h2>{{ promo() ? 'Cambiar promoción' : 'Nueva promoción' }}</h2>
          <div class="segmento" role="group" aria-label="Idioma">
            <button type="button" [attr.aria-pressed]="idioma() === 'es'" (click)="idioma.set('es')">Español@if (idiomaConError('es')) { <span aria-label="con errores"> !</span> }</button>
            <button type="button" [attr.aria-pressed]="idioma() === 'en'" (click)="idioma.set('en')">English@if (idiomaConError('en')) { <span aria-label="con errores"> !</span> }</button>
          </div>
        </div>

        @if (general(); as g) { <p class="aviso" role="alert">{{ g }}</p> }

        <fieldset class="tipos">
          <legend>Tipo de promoción</legend>
          @for (t of tipos; track t.clave) {
            <button type="button" class="tipo" [attr.aria-pressed]="f().tipo === t.clave" (click)="cambiarTipo(t.clave)"><b>{{ t.simbolo }}</b><span>{{ t.texto }}</span></button>
          }
        </fieldset>

        <label [class.error]="err('titulo.' + idioma())">Título @if (idioma() === 'es') { <span class="ayuda">(obligatorio en español)</span> } @else { <span class="ayuda">(opcional)</span> }
          <input type="text" name="titulo" maxlength="100" [(ngModel)]="f().titulo[idioma()]" placeholder="Ej. Mezcal de cortesía con tu cena" />
          <span class="contador">{{ f().titulo[idioma()].length }} / 100</span>
          @if (err('titulo.' + idioma()); as m) { <span class="msg">{{ m }}</span> }
        </label>
        <label [class.error]="err('descripcion.' + idioma())">Descripción <span class="ayuda">(opcional)</span>
          <textarea name="descripcion" rows="2" maxlength="500" [(ngModel)]="f().descripcion[idioma()]"></textarea>
          @if (err('descripcion.' + idioma()); as m) { <span class="msg">{{ m }}</span> }
        </label>

        <div class="campos">
          @if (conValor()) {
            <label [class.error]="err('valor')">{{ f().tipo === 'descuento_pct' ? 'Porcentaje de descuento' : 'Descuento en pesos' }}
              <input type="text" inputmode="decimal" name="valor" [(ngModel)]="f().valor" [placeholder]="f().tipo === 'descuento_pct' ? '15' : '100'" />
              @if (err('valor'); as m) { <span class="msg">{{ m }}</span> }
            </label>
          }
          <label [class.error]="err('ofertaId')">Aplica a <span class="ayuda">(opcional)</span>
            <select name="ofertaId" [(ngModel)]="f().ofertaId">
              <option value="">Todo el negocio</option>
              @for (o of ofertas(); track o.id) { <option [value]="o.id">{{ nombreDe(o) }}</option> }
            </select>
            @if (err('ofertaId'); as m) { <span class="msg">{{ m }}</span> }
          </label>
        </div>

        <div class="campos">
          <label [class.error]="err('inicio')">Empieza
            <input type="date" name="inicio" [(ngModel)]="f().inicio" />
            @if (err('inicio'); as m) { <span class="msg">{{ m }}</span> }
          </label>
          <label [class.error]="err('fin')">Termina
            <input type="date" name="fin" [min]="f().inicio" [(ngModel)]="f().fin" />
            @if (err('fin'); as m) { <span class="msg">{{ m }}</span> }
          </label>
          <label [class.error]="err('codigo')">Código <span class="ayuda">(opcional)</span>
            <input type="text" name="codigo" maxlength="30" [(ngModel)]="f().codigo" placeholder="OAXACA15" />
            @if (err('codigo'); as m) { <span class="msg">{{ m }}</span> }
          </label>
        </div>

        <label [class.error]="err('condiciones')">Condiciones <span class="ayuda">(opcional)</span>
          <textarea name="condiciones" rows="2" maxlength="500" [(ngModel)]="f().condiciones" placeholder="Válido de lunes a jueves. No acumulable."></textarea>
          <span class="contador">{{ f().condiciones.length }} / 500</span>
          @if (err('condiciones'); as m) { <span class="msg">{{ m }}</span> }
        </label>

        <div class="previa" aria-label="Así se verá">
          <small>Así se verá</small>
          <strong>{{ f().titulo['es'] || 'Tu título' }}</strong>
          <span class="insignia">{{ vista() }}</span>
          @if (f().inicio && f().fin) { <span class="suave chico">{{ periodo() }}</span> }
        </div>

        <p class="suave chico">Un borrador no se muestra a nadie. Al enviarla, el equipo de Travel Oaxaca la revisa antes de publicarla.</p>

        <div class="botones">
          <button type="submit" class="boton sec" [disabled]="trabajando()">{{ trabajando() && !enviando() ? 'Guardando…' : 'Guardar borrador' }}</button>
          <button type="button" class="boton" [disabled]="trabajando() || !puedeEnviar()" (click)="guardar(true)">{{ trabajando() && enviando() ? 'Enviando…' : 'Guardar y enviar a revisión' }}</button>
          <button type="button" class="enlace" [disabled]="trabajando()" (click)="cancelar.emit()">Cancelar</button>
        </div>
        @if (!puedeEnviar()) { <p class="suave chico">Podrás enviarla a revisión cuando tu ficha esté publicada.</p> }
      </div>
    </form>
  `,
  styles: `
    :host { display: contents; }
    form { display: contents; }
    fieldset.tipos { border: 0; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 8px; min-width: 0; }
    legend { font-weight: 600; margin-bottom: 6px; padding: 0; }
    .tipo { min-height: 64px; border: 1.5px solid var(--linea); border-radius: 12px; background: var(--papel); color: var(--tinta); display: grid; gap: 2px; justify-items: center; align-content: center; padding: 8px; cursor: pointer; font: 400 0.8rem var(--fuente); b { font: 800 1.2rem var(--fuente-titulo); } &[aria-pressed='true'] { border-color: var(--grana); background: var(--aviso); } }
    .previa { display: grid; gap: 4px; padding: 14px; border-radius: 12px; border: 1px dashed var(--linea); background: var(--cantera); small { color: var(--suave); text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.7rem; } strong { font: 700 1.05rem var(--fuente-titulo); overflow-wrap: anywhere; } .insignia { font-weight: 700; color: var(--grana); } }
    .botones { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .boton.sec { background: var(--papel); color: var(--tinta); border: 1.5px solid var(--linea); }
  `,
})
export class FormPromocion implements OnInit {
  readonly negocioId = input.required<string>();
  readonly promo = input<Promocion | null>(null);
  readonly ofertas = input<Oferta[]>([]);
  readonly puedeEnviar = input(true);
  readonly guardada = output<PromoGuardada>();
  readonly cancelar = output<void>();

  private readonly api = inject(Api);
  protected readonly tipos = TIPOS_PROMO;
  protected readonly nombreDe = nombreDe;
  protected readonly f = signal<FormPromo>(formVacioPromo());
  protected readonly idioma = signal<'es' | 'en'>('es');
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly general = signal<string | null>(null);
  protected readonly trabajando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly conValor = computed(() => usaValor(this.f().tipo));
  // Los campos se editan sobre el mismo objeto (ngModel), así que estos dos son métodos y no `computed`.
  protected vista(): string {
    return insignia({ tipo: this.f().tipo, valor: aNumero(this.f().valor) });
  }
  protected periodo(): string {
    const f = this.f();
    return f.inicio && f.fin && f.fin >= f.inicio ? periodoTexto(f.inicio, f.fin) : '';
  }

  ngOnInit(): void {
    const p = this.promo();
    this.f.set(p ? formDePromo(p) : formVacioPromo());
  }

  protected err(c: string): string | null {
    return this.errores()[c] ?? null;
  }

  protected idiomaConError(i: string): boolean {
    return Object.keys(this.errores()).some((k) => k === `titulo.${i}` || k === `descripcion.${i}`);
  }

  protected cambiarTipo(t: string): void {
    this.f.update((f) => ({ ...f, tipo: t, valor: usaValor(t) ? f.valor : '' }));
    this.errores.update((e) => {
      const { valor: _v, ...resto } = e;
      return resto;
    });
  }

  protected guardar(enviar: boolean): void {
    if (this.trabajando()) return;
    this.general.set(null);
    const locales = errorDePromo(this.f(), hoyIso());
    this.errores.set(locales);
    if (Object.keys(locales).length) {
      const primero = Object.keys(locales)[0];
      if (primero.endsWith('.en')) this.idioma.set('en');
      else if (primero.endsWith('.es')) this.idioma.set('es');
      this.general.set('Revisa los campos marcados.');
      return;
    }
    this.trabajando.set(true);
    this.enviando.set(enviar);
    const cuerpo = promoParaApi(this.f());
    const p = this.promo();
    const llamada = p ? this.api.actualizarPromocion(this.negocioId(), p.id, cuerpo) : this.api.crearPromocion(this.negocioId(), cuerpo);
    llamada.subscribe({
      next: (r) => {
        if (!enviar) return this.terminar({ promo: r.datos, aviso: 'Borrador guardado.' });
        this.api.enviarPromocion(this.negocioId(), r.datos.id).subscribe({
          next: (e) => this.terminar({ promo: e.datos, aviso: 'Enviada a revisión. Te avisaremos cuando el equipo la revise.' }),
          error: (er) => this.terminar({ promo: r.datos, aviso: `Se guardó como borrador, pero no se pudo enviar a revisión: ${leerError(er).general ?? 'inténtalo de nuevo.'}` }),
        });
      },
      error: (e) => {
        this.trabajando.set(false);
        const { general, campos } = leerError(e);
        const mapa: Record<string, string> = {};
        for (const [k, v] of Object.entries(campos)) mapa[k === 'textos' ? 'titulo.es' : k] = v;
        this.errores.set(mapa);
        this.general.set(general ?? 'Revisa los campos marcados.');
      },
    });
  }

  private terminar(r: PromoGuardada): void {
    this.trabajando.set(false);
    this.guardada.emit(r);
  }
}
