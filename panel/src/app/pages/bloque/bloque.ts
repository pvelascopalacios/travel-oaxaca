import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Catalogos } from '../../core/catalogos';
import {
  FormBloque, TIPOS_BLOQUE, bloqueParaApi, errorDeBloque, estadoContenido, etiquetasBloque, faltasParaPublicar, formBloqueVacio, formDeBloque, idiomasConTexto, textoBloqueVacio, tipoBloqueTexto,
} from '../../core/contenido';
import { ErrorApi, leerError } from '../../core/panel';
import { IdiomasPestanas } from '../../shared/idiomas-pestanas';
import { SelectorNegocio, NegocioElegido } from '../../shared/selector-negocio';
import { FotoSubida, SubirFoto } from '../../shared/subir-foto';
import { enlazarAviso, enlazarError } from '../../core/avisos';

/** Un bloque de la portada: destacado, pueblo, historia o reel. Nuevo (`/inicio/nuevo?tipo=reel`) o existente (`/inicio/:id`). */
@Component({
  selector: 'app-bloque',
  imports: [FormsModule, RouterLink, IdiomasPestanas, SubirFoto, SelectorNegocio],
  templateUrl: './bloque.html',
  styleUrl: './bloque.scss',
})
export class Bloque implements OnInit {
  readonly id = input.required<string>();
  /** Solo al crear. */
  readonly tipo = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly cat = inject(Catalogos);

  protected readonly nuevo = computed(() => this.id() === 'nuevo');
  protected form: FormBloque = formBloqueVacio();
  protected readonly version = signal(0);
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly errores = signal<Record<string, string>>({});
  protected readonly errorApi = signal<string | null>(null);
  private readonly _errorFlotante = enlazarError(() => this.errorApi(), () => this.errores());
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);
  protected readonly trabajando = signal(false);
  protected readonly archivando = signal(false);
  protected readonly idioma = signal('es');

  protected readonly tipos = TIPOS_BLOQUE;
  protected readonly tipoTexto = tipoBloqueTexto;
  protected readonly estadoInfo = estadoContenido;
  protected readonly etiquetas = computed(() => { this.version(); return etiquetasBloque(this.form.tipo); });
  protected readonly faltas = computed(() => { this.version(); return faltasParaPublicar(this.form); });
  protected readonly conTexto = computed(() => { this.version(); return idiomasConTexto(this.form.textos, (t) => t.titulo); });
  protected readonly idiomasConError = computed(() => Object.keys(this.errores()).filter((k) => /^(texto|titulo)-/.test(k)).map((k) => k.split('-')[1]));
  protected readonly indigenas = computed(() => this.cat.idiomas().filter((i) => i.esIndigena));
  protected readonly textoActual = computed(() => { this.version(); return this.form.textos[this.idioma()] ?? (this.form.textos[this.idioma()] = textoBloqueVacio()); });

  ngOnInit(): void {
    this.cat.cargar();
    if (this.nuevo()) {
      const t = this.tipo();
      this.form = formBloqueVacio(TIPOS_BLOQUE.some((x) => x.clave === t) ? t! : 'destacado');
      this.cargando.set(false);
      return;
    }
    this.api.bloque(this.id()).subscribe({
      next: (b) => {
        this.form = formDeBloque(b);
        this.cargando.set(false);
        this.cambio();
        if (b.negocioId) this.api.negocio(b.negocioId).subscribe({ next: (f) => { this.form.negocioNombre = f.nombreComercial; this.cambio(); }, error: () => undefined });
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar este bloque.'));
        this.cargando.set(false);
      },
    });
  }

  protected cambio(): void { this.version.update((n) => n + 1); }

  protected elegirTipo(t: string): void {
    if (!this.nuevo()) return;
    this.form = { ...formBloqueVacio(t), textos: this.form.textos, estado: this.form.estado, orden: this.form.orden, medioId: this.form.medioId, fotoUrl: this.form.fotoUrl, credito: this.form.credito };
    this.cambio();
  }

  protected fotoLista(f: FotoSubida): void {
    this.form.medioId = f.medioId;
    this.form.fotoUrl = f.url;
    this.cambio();
  }

  protected elegirNegocio(n: NegocioElegido | null): void {
    this.form.negocioId = n?.id ?? null;
    this.form.negocioNombre = n?.nombre ?? '';
    this.cambio();
  }

  protected guardar(): void {
    if (this.trabajando()) return;
    this.aviso.set(null);
    this.errorApi.set(null);
    const errores = errorDeBloque(this.form);
    this.errores.set(errores);
    if (Object.keys(errores).length) {
      this.errorApi.set('Revisa los campos marcados.');
      return;
    }
    this.trabajando.set(true);
    const cuerpo = bloqueParaApi(this.form);
    const llamada = this.nuevo() ? this.api.crearBloque(cuerpo) : this.api.actualizarBloque(this.id(), cuerpo);
    llamada.subscribe({
      next: (r) => {
        this.trabajando.set(false);
        if (this.nuevo() && r.datos) {
          void this.router.navigate(['/inicio', r.datos.id], { state: { aviso: 'Bloque creado.' } });
          return;
        }
        if (r.datos) { this.form = formDeBloque(r.datos); this.form.negocioNombre = this.form.negocioNombre || ''; }
        this.aviso.set('Bloque guardado.');
        this.cambio();
      },
      error: (e) => {
        this.trabajando.set(false);
        const er = leerError(e);
        this.errorApi.set(er.general);
        if (er.campos) this.errores.set(er.campos);
      },
    });
  }

  protected archivar(): void {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    this.api.archivarBloque(this.id()).subscribe({
      next: () => void this.router.navigate(['/inicio'], { queryParams: { tipo: this.form.tipo } }),
      error: (e) => { this.trabajando.set(false); this.archivando.set(false); this.errorApi.set(leerError(e).general); },
    });
  }
}
