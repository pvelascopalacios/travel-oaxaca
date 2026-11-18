import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Api } from '../core/api';
import {
  fijarMeGusta, insertarComentario, buscarComentario, puedeResponder, quitarComentario, reemplazarComentario, totalTrasAlternar, unirPagina, validarComentario,
  MAX_COMENTARIO,
} from '../core/comunidad';
import { leerError } from '../core/cuenta';
import { I18n } from '../core/i18n';
import { Comentario, SeccionComentarios } from '../core/modelos';
import { Sesion } from '../core/sesion';
import { irAIngresar } from './pedir-sesion';
import { Reportar } from './reportar';

const TAMANO = 10;

/** Comentarios de un lugar, una ruta o un evento. Leer es público; comentar, dar «me gusta» y reportar piden cuenta. */
@Component({
  selector: 'app-comentarios',
  imports: [FormsModule, NgTemplateOutlet, Reportar],
  template: `
    <section class="coms" id="comentarios" [attr.aria-label]="i18n.t('comTitulo')">
      <h2>{{ i18n.t('comTitulo') }} <span class="cuenta">{{ total() }}</span></h2>

      @if (!sesion.autenticado()) {
        <div class="invita">
          <span class="suave">{{ i18n.t('comPlaceholder') }}</span>
          <button type="button" class="boton" (click)="ingresar()">{{ i18n.t('comIngresa') }}</button>
        </div>
        <p class="suave chico aviso-corto">{{ i18n.t('comAviso') }}</p>
      } @else if (!sesion.usuario()?.correoVerificado) {
        <div class="banner" role="status">
          <p>{{ i18n.t('comConfirmaCorreo') }}</p>
          <button type="button" class="boton secundario" [disabled]="reenviando()" (click)="reenviar()">{{ i18n.t('reenviarCorreo') }}</button>
          @if (avisoCorreo()) { <p class="suave">{{ avisoCorreo() }}</p> }
        </div>
      } @else {
        <form class="nuevo" (ngSubmit)="publicar(null)">
          <label>
            <span class="visualmente-oculto">{{ i18n.t('comPlaceholder') }}</span>
            <textarea name="nuevo" rows="3" [maxLength]="max" [placeholder]="i18n.t('comPlaceholder')" [(ngModel)]="texto"></textarea>
          </label>
          <div class="fila">
            <button type="submit" class="boton" [disabled]="enviando()">{{ i18n.t('comPublicar') }}</button>
            <span class="suave chico">{{ i18n.t('comAviso') }}</span>
          </div>
          @if (errorNuevo()) { <p class="aviso-error" role="alert">{{ errorNuevo() }}</p> }
        </form>
      }
      @if (aviso()) { <p class="aviso" role="status">{{ aviso() }}</p> }

      @if (lista().length) {
        <ul class="lista">
          @for (c of lista(); track c.id) {
            <li class="com">
              <ng-container [ngTemplateOutlet]="fila" [ngTemplateOutletContext]="{ $implicit: c }" />
              @if (respondiendo() === c.id) {
                <form class="resp" (ngSubmit)="publicar(c.id)">
                  <label>
                    <span class="visualmente-oculto">{{ i18n.t('comResponderA') }}</span>
                    <textarea name="resp" rows="2" [maxLength]="max" [placeholder]="i18n.t('comResponderA')" [(ngModel)]="textoRespuesta"></textarea>
                  </label>
                  <div class="fila">
                    <button type="submit" class="boton" [disabled]="enviando()">{{ i18n.t('comResponder') }}</button>
                    <button type="button" class="boton secundario" (click)="respondiendo.set(null)">{{ i18n.t('cancelar') }}</button>
                  </div>
                  @if (errorResp()) { <p class="aviso-error" role="alert">{{ errorResp() }}</p> }
                </form>
              }
              @if (c.respuestas.length) {
                <ul class="hijos">
                  @for (r of c.respuestas; track r.id) {
                    <li class="com hijo"><ng-container [ngTemplateOutlet]="fila" [ngTemplateOutletContext]="{ $implicit: r }" /></li>
                  }
                </ul>
              }
            </li>
          }
        </ul>
        @if (hayMas()) {
          <button type="button" class="boton secundario" [disabled]="cargando()" (click)="masComentarios()">{{ i18n.t('comVerMas') }}</button>
        }
      } @else if (!cargando() && !fallo()) {
        <p class="suave">{{ i18n.t('comNinguno') }}</p>
      }
      @if (fallo()) { <p class="suave">{{ i18n.t('errorCarga') }}</p> }

      @if (reportando(); as id) {
        <app-reportar tipo="comentario" [objetivoId]="id" (cerrar)="reportando.set(null)" />
      }
    </section>

    <ng-template #fila let-c>
      <p class="quien">
        <span class="av" aria-hidden="true">{{ iniciales(c) }}</span>
        <strong>{{ c.mio ? i18n.t('comTu') : c.autorNombre || '—' }}</strong>
        @if (c.estado === 'pendiente') { <span class="chip">{{ i18n.t('comEnRevision') }}</span> }
        <span class="suave">· {{ fecha(c) }}</span>
      </p>
      @if (editando() === c.id) {
        <form class="resp" (ngSubmit)="guardarEdicion(c)">
          <label>
            <span class="visualmente-oculto">{{ i18n.t('comEditar') }}</span>
            <textarea name="edit" rows="3" [maxLength]="max" [(ngModel)]="textoEdicion"></textarea>
          </label>
          <div class="fila">
            <button type="submit" class="boton" [disabled]="enviando()">{{ i18n.t('comGuardar') }}</button>
            <button type="button" class="boton secundario" (click)="editando.set(null)">{{ i18n.t('cancelar') }}</button>
          </div>
          @if (errorEdicion()) { <p class="aviso-error" role="alert">{{ errorEdicion() }}</p> }
        </form>
      } @else {
        <p class="texto">{{ c.texto }}</p>
        @if (c.estado === 'pendiente') { <p class="suave chico">{{ i18n.t('comRevisionNota') }}</p> }
        <div class="acc">
          @if (c.estado !== 'pendiente') {
            <button type="button" class="lnk" [class.on]="c.yoLeDiMeGusta" [attr.aria-pressed]="c.yoLeDiMeGusta" [attr.aria-label]="i18n.t('comMeGusta')" (click)="meGusta(c)">
              <span aria-hidden="true">{{ c.yoLeDiMeGusta ? '♥' : '♡' }}</span> {{ c.meGusta }}
            </button>
          }
          @if (puedeResponder(c) && c.estado !== 'pendiente') {
            <button type="button" class="lnk" (click)="abrirRespuesta(c)">{{ i18n.t('comResponder') }}</button>
          }
          @if (c.mio) {
            <button type="button" class="lnk" (click)="abrirEdicion(c)">{{ i18n.t('comEditar') }}</button>
            @if (borrando() === c.id) {
              <span class="suave">{{ i18n.t('comBorrarPregunta') }}</span>
              <button type="button" class="lnk peligro" [disabled]="enviando()" (click)="borrar(c)">{{ i18n.t('comSi') }}</button>
              <button type="button" class="lnk" (click)="borrando.set(null)">{{ i18n.t('cancelar') }}</button>
            } @else {
              <button type="button" class="lnk" (click)="borrando.set(c.id)">{{ i18n.t('comBorrar') }}</button>
            }
          } @else {
            <button type="button" class="lnk" (click)="reportar(c)">{{ i18n.t('reportar') }}</button>
          }
        </div>
        @if (errorFila()?.id === c.id) { <p class="aviso-error" role="alert">{{ errorFila()!.mensaje }}</p> }
      }
    </ng-template>
  `,
  styleUrl: './comentarios.scss',
})
export class Comentarios implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  private readonly router = inject(Router);

  readonly seccion = input.required<SeccionComentarios>();
  readonly slug = input.required<string>();
  /** Id del lugar, ruta o evento: es el que pide la API para publicar. */
  readonly objetoId = input.required<string>();

  protected readonly max = MAX_COMENTARIO;
  protected readonly puedeResponder = puedeResponder;
  protected readonly lista = signal<Comentario[]>([]);
  protected readonly total = signal(0);
  protected readonly cargando = signal(false);
  protected readonly fallo = signal(false);
  protected readonly enviando = signal(false);
  protected readonly aviso = signal<string | null>(null);
  protected readonly errorNuevo = signal<string | null>(null);
  protected readonly errorResp = signal<string | null>(null);
  protected readonly errorEdicion = signal<string | null>(null);
  protected readonly errorFila = signal<{ id: string; mensaje: string } | null>(null);
  protected readonly respondiendo = signal<string | null>(null);
  protected readonly editando = signal<string | null>(null);
  protected readonly borrando = signal<string | null>(null);
  protected readonly reportando = signal<string | null>(null);
  protected readonly reenviando = signal(false);
  protected readonly avisoCorreo = signal<string | null>(null);
  protected texto = '';
  protected textoRespuesta = '';
  protected textoEdicion = '';
  private pagina = 1;
  private cargadoConSesion: boolean | undefined;

  constructor() {
    // Al aparecer o cerrarse la sesión se vuelve a pedir la lista, para que traiga lo «mío» y los «me gusta».
    effect(() => {
      const a = this.sesion.autenticado();
      untracked(() => {
        if (this.cargadoConSesion !== undefined && this.cargadoConSesion !== a) this.cargar(true);
      });
    });
  }

  ngOnInit(): void {
    this.cargar(true);
  }

  protected hayMas(): boolean {
    return this.pagina * TAMANO < this.total();
  }

  protected iniciales(c: Comentario): string {
    const n = (c.mio ? this.sesion.usuario()?.nombre : c.autorNombre) ?? '';
    const partes = n.replace(/[.]/g, '').trim().split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase() || '·';
  }

  protected fecha(c: Comentario): string {
    return this.i18n.fecha(c.creadoEn.slice(0, 10), { day: 'numeric', month: 'short' });
  }

  protected ingresar(): void {
    irAIngresar(this.router, this.i18n);
  }

  protected masComentarios(): void {
    this.cargar(false);
  }

  private cargar(reiniciar: boolean): void {
    if (reiniciar) this.pagina = 1;
    else this.pagina += 1;
    this.cargadoConSesion = this.sesion.autenticado();
    this.cargando.set(true);
    this.api
      .comentarios(this.seccion(), this.slug(), { pagina: this.pagina, tamano: TAMANO })
      .pipe(catchError(() => { this.fallo.set(true); return of(null); }))
      .subscribe((r) => {
        this.cargando.set(false);
        if (!r) return;
        this.fallo.set(false);
        this.total.set(r.total);
        this.lista.set(reiniciar ? r.elementos : unirPagina(this.lista(), r.elementos));
      });
  }

  protected reenviar(): void {
    const u = this.sesion.usuario();
    if (!u) return;
    this.reenviando.set(true);
    this.api.reenviarVerificacion(u.correo).subscribe({
      next: () => { this.reenviando.set(false); this.avisoCorreo.set(this.i18n.t('reenviarCorreo') + ' ✓'); },
      error: (e) => { this.reenviando.set(false); this.avisoCorreo.set(leerError(e, this.i18n.t('errorCarga')).general); },
    });
  }

  protected publicar(padreId: string | null): void {
    const texto = (padreId ? this.textoRespuesta : this.texto).trim();
    const salida = padreId ? this.errorResp : this.errorNuevo;
    const falla = validarComentario(texto);
    if (falla) {
      salida.set(this.i18n.t(falla === 'comentarioVacio' ? 'comVacio' : 'comLargo'));
      return;
    }
    salida.set(null);
    this.aviso.set(null);
    this.enviando.set(true);
    this.api.comentar(this.seccion(), this.objetoId(), texto, padreId).subscribe({
      next: (r) => {
        this.enviando.set(false);
        const c = { ...r.datos, mio: true, respuestas: r.datos.respuestas ?? [], yoLeDiMeGusta: false };
        this.lista.set(insertarComentario(this.lista(), c));
        if (!padreId) this.total.update((n) => n + 1);
        if (c.estado === 'pendiente') this.aviso.set(r.mensajes?.[0] || this.i18n.t('comRevisionNota'));
        if (padreId) { this.textoRespuesta = ''; this.respondiendo.set(null); } else this.texto = '';
      },
      error: (e) => { this.enviando.set(false); salida.set(leerError(e, this.i18n.t('comErrorEnviar')).general); },
    });
  }

  protected abrirRespuesta(c: Comentario): void {
    if (!this.sesion.autenticado()) return this.ingresar();
    this.textoRespuesta = '';
    this.errorResp.set(null);
    this.respondiendo.set(c.id);
  }

  protected abrirEdicion(c: Comentario): void {
    this.textoEdicion = c.texto;
    this.errorEdicion.set(null);
    this.editando.set(c.id);
  }

  protected guardarEdicion(c: Comentario): void {
    const texto = this.textoEdicion.trim();
    const falla = validarComentario(texto);
    if (falla) {
      this.errorEdicion.set(this.i18n.t(falla === 'comentarioVacio' ? 'comVacio' : 'comLargo'));
      return;
    }
    this.enviando.set(true);
    this.api.editarComentario(c.id, texto).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.lista.set(reemplazarComentario(this.lista(), { ...r.datos, mio: true, respuestas: [] }));
        this.editando.set(null);
        if (r.datos.estado === 'pendiente') this.aviso.set(r.mensajes?.[0] || this.i18n.t('comRevisionNota'));
      },
      error: (e) => { this.enviando.set(false); this.errorEdicion.set(leerError(e, this.i18n.t('comErrorEnviar')).general); },
    });
  }

  protected borrar(c: Comentario): void {
    this.enviando.set(true);
    this.api.borrarComentario(c.id).subscribe({
      next: () => {
        this.enviando.set(false);
        this.borrando.set(null);
        if (c.padreId === null) this.total.update((n) => Math.max(0, n - 1));
        this.lista.set(quitarComentario(this.lista(), c.id));
      },
      error: (e) => {
        this.enviando.set(false);
        this.errorFila.set({ id: c.id, mensaje: leerError(e, this.i18n.t('comErrorEnviar')).general ?? '' });
      },
    });
  }

  protected meGusta(c: Comentario): void {
    if (!this.sesion.autenticado()) return this.ingresar();
    const activo = c.yoLeDiMeGusta;
    // Se pinta de inmediato y se corrige con el total que confirma la API; si falla, se regresa.
    this.lista.set(fijarMeGusta(this.lista(), c.id, !activo, totalTrasAlternar(c.meGusta, activo)));
    const llamada = activo ? this.api.quitarReaccion('comentario', c.id) : this.api.reaccionar('comentario', c.id);
    llamada.subscribe({
      next: (r) => this.lista.set(fijarMeGusta(this.lista(), c.id, !activo, r.datos.total)),
      error: () => {
        const actual = buscarComentario(this.lista(), c.id);
        if (actual) this.lista.set(fijarMeGusta(this.lista(), c.id, activo, c.meGusta));
      },
    });
  }

  protected reportar(c: Comentario): void {
    if (!this.sesion.autenticado()) return this.ingresar();
    this.reportando.set(c.id);
  }
}
