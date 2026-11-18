import { Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Api } from '../core/api';
import { I18n } from '../core/i18n';
import { Resena, ResenasPublicas } from '../core/modelos';
import { Sesion } from '../core/sesion';
import { irAIngresar } from './pedir-sesion';
import { Reportar } from './reportar';

const TAMANO = 5;

/** Reseñas publicadas del negocio. La calificación solo se muestra con 3 reseñas o más. */
@Component({
  selector: 'app-resenas',
  imports: [RouterLink, Reportar],
  template: `
    <section class="resenas" id="resenas" [attr.aria-label]="i18n.t('resenasTitulo')">
      <div class="cab">
        <h2>{{ i18n.t('resenasTitulo') }}</h2>
        <a class="boton secundario" [routerLink]="['/', i18n.lang(), 'negocio', slug(), 'resena']">{{ i18n.t(tengoResena() ? 'editarMiResena' : 'escribirResena') }}</a>
      </div>

      @if (resumen(); as r) {
        @if (r.calificacion.total >= 3 && r.calificacion.promedio != null) {
          <div class="resumen">
            <p class="nota"><strong>{{ r.calificacion.promedio.toFixed(1) }}</strong><span class="estrellas" aria-hidden="true">★</span></p>
            <p class="suave">{{ r.calificacion.total }} {{ i18n.t('resenas') }}</p>
            <ul class="barras">
              @for (n of [5, 4, 3, 2, 1]; track n) {
                <li>
                  <span>{{ n }}★</span>
                  <span class="barra"><span class="relleno" [style.width.%]="porcentaje(r, n)"></span></span>
                  <span class="cuenta">{{ r.calificacion.distribucion[n] ?? 0 }}</span>
                </li>
              }
            </ul>
          </div>
        } @else {
          <p class="suave">{{ i18n.t('resenasPocas') }}</p>
        }
      }

      @if (lista().length) {
        @if ((resumen()?.resenas?.total ?? 0) > 1) {
          <label class="orden">
            <span class="visualmente-oculto">{{ i18n.t('ordenarResenas') }}</span>
            <select [value]="orden()" (change)="cambiarOrden($any($event.target).value)">
              @for (o of ordenes; track o) {
                <option [value]="o">{{ i18n.tDinamico('orden', o) }}</option>
              }
            </select>
          </label>
        }
        <ul class="lista">
          @for (x of lista(); track x.id) {
            <li class="resena">
              <p class="linea">
                <span class="estrellas" [attr.aria-label]="x.calificacion + ' / 5'">{{ '★'.repeat(x.calificacion) }}<span class="apagadas">{{ '★'.repeat(5 - x.calificacion) }}</span></span>
                <strong>{{ x.autorNombre || '—' }}</strong>
                @if (x.mia) { <span class="suya">{{ i18n.t('tuResena') }}</span> }
                <span class="suave">· {{ fecha(x) }}</span>
              </p>
              @if (x.titulo) {
                <h3>{{ x.titulo }}</h3>
              }
              @if (x.texto) {
                <p class="texto">{{ x.texto }}</p>
              }
              @if (x.fechaVisita) {
                <p class="suave chico">{{ i18n.tf('visitoEl', { fecha: i18n.fecha(x.fechaVisita, { day: 'numeric', month: 'long', year: 'numeric' }) }) }}</p>
              }
              @if (x.respuesta; as resp) {
                <div class="respuesta">
                  <p class="chico"><strong>{{ i18n.t('respuestaNegocio') }}</strong></p>
                  <p class="texto">{{ resp.texto }}</p>
                </div>
              }
              <div class="acc">
                @if (x.mia) {
                  @if (x.utiles > 0) { <span class="suave chico">{{ i18n.tf('utilesN', { n: x.utiles }) }}</span> }
                } @else {
                  <button type="button" class="util" [class.on]="x.yoMarqueUtil" [attr.aria-pressed]="!!x.yoMarqueUtil" [disabled]="ocupadas().has(x.id)" (click)="util(x)">
                    <span aria-hidden="true">👍</span> {{ i18n.t('utilBoton') }}@if (x.utiles > 0) { · {{ x.utiles }} }
                  </button>
                  <button type="button" class="util" (click)="reportar(x)">{{ i18n.t('reportar') }}</button>
                }
              </div>
            </li>
          }
        </ul>
        @if (hayMas()) {
          <button type="button" class="boton secundario" [disabled]="cargando()" (click)="masResenas()">{{ i18n.t('verMasResenas') }}</button>
        }
      }
      @if (fallo()) {
        <p class="suave">{{ i18n.t('errorCarga') }}</p>
      }
      @if (reportando(); as id) {
        <app-reportar tipo="resena" [objetivoId]="id" (cerrar)="reportando.set(null)" />
      }
    </section>
  `,
  styleUrl: './resenas.scss',
})
export class Resenas implements OnInit {
  protected readonly i18n = inject(I18n);
  private readonly api = inject(Api);
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);
  readonly slug = input.required<string>();

  protected readonly ordenes = ['recientes', 'mejor', 'peor', 'utiles'];
  protected readonly resumen = signal<ResenasPublicas | null>(null);
  protected readonly lista = signal<Resena[]>([]);
  protected readonly orden = signal('recientes');
  protected readonly cargando = signal(false);
  protected readonly fallo = signal(false);
  protected readonly reportando = signal<string | null>(null);
  protected readonly tengoResena = computed(() => this.lista().some((r) => !!r.mia));
  protected readonly ocupadas = signal<ReadonlySet<string>>(new Set());
  private pagina = 1;
  private cargadaConSesion: boolean | undefined;

  constructor() {
    // Con sesión la API marca cuáles reseñas son mías y cuáles ya marqué como útiles: se vuelve a pedir al entrar o salir.
    effect(() => {
      const a = this.sesion.autenticado();
      untracked(() => {
        if (this.cargadaConSesion !== undefined && this.cargadaConSesion !== a) this.cargar(true);
      });
    });
  }

  ngOnInit(): void {
    this.cargar(true);
  }

  protected hayMas(): boolean {
    const r = this.resumen();
    return !!r && this.lista().length < r.resenas.total;
  }

  protected porcentaje(r: ResenasPublicas, n: number): number {
    const t = r.calificacion.total || 1;
    return Math.round(((r.calificacion.distribucion[n] ?? 0) / t) * 100);
  }

  protected fecha(x: Resena): string {
    return this.i18n.fecha(x.creadoEn.slice(0, 10), { month: 'short', year: 'numeric' });
  }

  protected cambiarOrden(o: string): void {
    this.orden.set(o);
    this.cargar(true);
  }

  protected masResenas(): void {
    this.cargar(false);
  }

  protected util(x: Resena): void {
    if (!this.sesion.autenticado()) return irAIngresar(this.router, this.i18n);
    const activo = !!x.yoMarqueUtil;
    this.ocupadas.update((s) => new Set(s).add(x.id));
    const fijar = (marcado: boolean, total: number) =>
      this.lista.update((l) => l.map((r) => (r.id === x.id ? { ...r, yoMarqueUtil: marcado, utiles: Math.max(0, total) } : r)));
    fijar(!activo, x.utiles + (activo ? -1 : 1));
    const llamada = activo ? this.api.quitarReaccion('resena', x.id) : this.api.reaccionar('resena', x.id);
    const soltar = () => this.ocupadas.update((s) => { const n = new Set(s); n.delete(x.id); return n; });
    llamada.subscribe({
      next: (r) => { fijar(!activo, r.datos.total); soltar(); },
      error: () => { fijar(activo, x.utiles); soltar(); },
    });
  }

  protected reportar(x: Resena): void {
    if (!this.sesion.autenticado()) return irAIngresar(this.router, this.i18n);
    this.reportando.set(x.id);
  }

  private cargar(reiniciar: boolean): void {
    if (reiniciar) this.pagina = 1;
    else this.pagina += 1;
    this.cargadaConSesion = this.sesion.autenticado();
    this.cargando.set(true);
    this.api
      .resenas(this.slug(), { orden: this.orden(), pagina: this.pagina, tamano: TAMANO })
      .pipe(catchError(() => { this.fallo.set(true); return of(null); }))
      .subscribe((r) => {
        this.cargando.set(false);
        if (!r) return;
        this.fallo.set(false);
        this.resumen.set(r);
        this.lista.set(reiniciar ? r.resenas.elementos : [...this.lista(), ...r.resenas.elementos]);
      });
  }
}
