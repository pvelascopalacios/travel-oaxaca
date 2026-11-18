import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { fechaLarga } from '../../core/cobros';
import { ESTADOS_GENERALES, TIPOS_BLOQUE, estadoContenido, tipoBloqueTexto } from '../../core/contenido';
import { BloqueResumen } from '../../core/modelos';
import { ErrorApi, leerError } from '../../core/panel';

/** Los bloques de la portada del sitio, por tipo: destacados, pueblos, historias y Reels. */
@Component({
  selector: 'app-inicio',
  imports: [FormsModule, RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
})
export class Inicio {
  /** /inicio?tipo=reel&estado=publicado&pagina=2 */
  readonly tipo = input<string>();
  readonly estado = input<string>();
  readonly pagina = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);

  protected readonly tipos = TIPOS_BLOQUE;
  protected readonly estados = ESTADOS_GENERALES;
  protected readonly tipoActual = computed(() => (TIPOS_BLOQUE.some((t) => t.clave === this.tipo()) ? this.tipo()! : 'destacado'));
  protected readonly filas = signal<BloqueResumen[]>([]);
  protected readonly total = signal(0);
  protected readonly conteos = signal<Record<string, number>>({});
  protected readonly tamano = 20;
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);

  protected readonly estadoInfo = estadoContenido;
  protected readonly tipoTexto = tipoBloqueTexto;
  protected readonly fecha = fechaLarga;
  protected readonly nPagina = computed(() => Math.max(0, (Number(this.pagina()) || 1) - 1));
  protected readonly hayAnterior = computed(() => this.nPagina() > 0);
  protected readonly haySiguiente = computed(() => (this.nPagina() + 1) * this.tamano < this.total());
  protected readonly desde = computed(() => (this.total() === 0 ? 0 : this.nPagina() * this.tamano + 1));
  protected readonly hasta = computed(() => Math.min(this.total(), (this.nPagina() + 1) * this.tamano));

  constructor() {
    effect(() => {
      this.tipoActual();
      this.estado();
      this.pagina();
      this.cargar();
    });
    for (const t of TIPOS_BLOQUE) {
      this.api.bloques({ tipo: t.clave, tamano: 1 }).subscribe({ next: (p) => this.conteos.update((c) => ({ ...c, [t.clave]: p.total })), error: () => undefined });
    }
  }

  protected consulta(extra: Record<string, string | null>): Record<string, string | null> {
    return { tipo: this.tipoActual(), estado: this.estado() || null, pagina: null, ...extra };
  }

  protected navegar(extra: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: this.consulta(extra) });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.bloques({ tipo: this.tipoActual(), estado: this.estado(), pagina: this.nPagina(), tamano: this.tamano }).subscribe({
      next: (p) => {
        this.filas.set(p.elementos);
        this.total.set(p.total);
        this.conteos.update((c) => (this.estado() ? c : { ...c, [this.tipoActual()]: p.total }));
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar los bloques. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
  }
}
