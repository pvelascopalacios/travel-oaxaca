import { Component, OnInit, RESPONSE_INIT, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { ErrorApi, leerError } from '../../core/cuenta';
import { esNoEncontrado } from '../../core/ficha';
import { hoyMx } from '../../core/filtros';
import { I18n } from '../../core/i18n';
import { MiResena, NegocioPublico } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Sesion } from '../../core/sesion';
import { NoExiste } from '../../shared/no-existe';

/** Escribir, editar o borrar la reseña propia de un negocio (una por persona y negocio). */
@Component({
  selector: 'app-resenar',
  imports: [FormsModule, RouterLink, NoExiste],
  templateUrl: './resenar.html',
  styleUrl: './resenar.scss',
})
export class Resenar implements OnInit {
  protected readonly i18n = inject(I18n);
  protected readonly sesion = inject(Sesion);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly respuesta = inject(RESPONSE_INIT, { optional: true });

  protected readonly negocio = signal<NegocioPublico | null>(null);
  protected readonly noExiste = signal(false);
  protected readonly miResena = signal<MiResena | null>(null);
  protected readonly cargando = signal(true);
  protected readonly enviando = signal(false);
  protected readonly error = signal<ErrorApi>({ general: null, campos: {} });
  protected readonly aviso = signal<string | null>(null);
  protected readonly confirmarBorrar = signal(false);
  protected readonly hecho = signal(false);
  protected readonly hoy = hoyMx();

  protected calificacion = 0;
  protected titulo = '';
  protected texto = '';
  protected fecha = '';
  protected readonly estrellas = [1, 2, 3, 4, 5];

  private slug = '';

  constructor() {
    effect(() => {
      // Cuando se sabe quién es la persona, se busca su reseña; sin sesión se manda a ingresar y se regresa aquí.
      if (!this.sesion.listo() || !this.negocio()) return;
      if (!this.sesion.autenticado()) {
        untracked(() => void this.router.navigate(['/', this.i18n.lang(), 'ingresar'], { queryParams: { volver: this.router.url } }));
        return;
      }
      untracked(() => this.buscarMia());
    });
  }

  ngOnInit(): void {
    this.slug = this.ruta.snapshot.paramMap.get('slug') ?? '';
    this.api.negocio(this.slug).subscribe({
      next: (n) => {
        this.negocio.set(n);
        this.seo.pagina(this.i18n.tf('resenarSeo', { nombre: n.nombre }), this.i18n.t('resenarTexto'), `negocio/${n.slug}/resena`, { noIndexar: true });
      },
      error: (e) => {
        this.cargando.set(false);
        if (esNoEncontrado(e)) {
          this.noExiste.set(true);
          if (this.respuesta) this.respuesta.status = 404;
        } else this.error.set(leerError(e, this.i18n.t('errorCarga')));
      },
    });
  }

  private buscarMia(): void {
    const n = this.negocio();
    if (!n) return;
    this.cargando.set(true);
    this.api.miResena(n.id).subscribe({
      next: (r) => { this.llenar(r); this.cargando.set(false); },
      // 404 = todavía no reseña este negocio.
      error: (e) => {
        if (!(e instanceof HttpErrorResponse && e.status === 404)) this.error.set(leerError(e, this.i18n.t('errorCarga')));
        this.cargando.set(false);
      },
    });
  }

  private llenar(r: MiResena | null): void {
    this.miResena.set(r);
    this.calificacion = r?.calificacion ?? 0;
    this.titulo = r?.titulo ?? '';
    this.texto = r?.texto ?? '';
    this.fecha = r?.fechaVisita ?? '';
  }

  protected campo(n: string): string | null {
    return this.error().campos[n] ?? null;
  }

  protected enviar(): void {
    const n = this.negocio();
    if (!n || this.enviando()) return;
    this.error.set({ general: null, campos: {} });
    this.aviso.set(null);
    if (this.calificacion < 1) {
      this.error.set({ general: null, campos: { calificacion: this.i18n.t('eligeCalificacion') } });
      return;
    }
    this.enviando.set(true);
    const cuerpo = {
      calificacion: this.calificacion,
      titulo: this.titulo.trim() || null,
      texto: this.texto.trim() || null,
      fechaVisita: this.fecha || null,
      idioma: this.i18n.lang(),
    };
    const previa = this.miResena();
    (previa ? this.api.editarResena(previa.id, cuerpo) : this.api.crearResena(n.id, cuerpo)).subscribe({
      next: (r) => {
        this.enviando.set(false);
        this.llenar(r.datos);
        this.aviso.set(r.mensajes?.[0] ?? this.i18n.t('resenaGracias'));
        this.hecho.set(true);
      },
      error: (e) => { this.enviando.set(false); this.error.set(leerError(e, this.i18n.t('errorCarga'))); },
    });
  }

  protected borrar(): void {
    const previa = this.miResena();
    if (!previa) return;
    this.enviando.set(true);
    this.api.borrarResena(previa.id).subscribe({
      next: () => {
        this.enviando.set(false);
        this.confirmarBorrar.set(false);
        this.llenar(null);
        this.hecho.set(false);
        this.aviso.set(this.i18n.t('resenaBorrada'));
      },
      error: (e) => { this.enviando.set(false); this.error.set(leerError(e, this.i18n.t('errorCarga'))); },
    });
  }

  protected estadoTexto(e: string | null): string {
    return e ? this.i18n.tDinamico('estadoResena', e) : '';
  }
}
