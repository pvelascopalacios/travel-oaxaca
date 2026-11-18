import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { Api } from '../../core/api';
import { ESTADOS_EVENTO, ESTADOS_GENERALES, ESTADOS_RUTA, estadoContenido } from '../../core/contenido';
import { fechaLarga } from '../../core/cobros';
import { ResumenContenido } from '../../core/modelos';
import { ErrorApi, leerError } from '../../core/panel';

type Tipo = 'lugares' | 'rutas' | 'eventos';
const TEXTOS: Record<Tipo, { titulo: string; ayuda: string; nuevo: string; vacio: string }> = {
  lugares: { titulo: 'Lugares', ayuda: 'Sitios arqueológicos, naturales, mercados, templos y más. Quien captura responde porque los datos sean verídicos.', nuevo: 'Nuevo lugar', vacio: 'Aún no hay lugares con estos filtros.' },
  rutas: { titulo: 'Rutas', ayuda: 'Recorridos con paradas en orden: lugares, negocios o puntos del mapa.', nuevo: 'Nueva ruta', vacio: 'Aún no hay rutas con estos filtros.' },
  eventos: { titulo: 'Eventos', ayuda: 'Fiestas y celebraciones con fechas, sede y los negocios que participan.', nuevo: 'Nuevo evento', vacio: 'Aún no hay eventos con estos filtros.' },
};

/** Lista de lugares, rutas o eventos (todos los estados), con búsqueda, filtro de estado y páginas. */
@Component({
  selector: 'app-lista-contenido',
  imports: [FormsModule, RouterLink],
  templateUrl: './lista.html',
  styleUrl: './lista.scss',
})
export class ListaContenido {
  /** /lugares?q=monte&estado=publicado&pagina=2 */
  readonly q = input<string>();
  readonly estado = input<string>();
  readonly pagina = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly tipo = (inject(ActivatedRoute).snapshot.data['tipo'] ?? 'lugares') as Tipo;
  protected readonly textos = TEXTOS[this.tipo];
  protected readonly estados = this.tipo === 'rutas' ? ESTADOS_RUTA : this.tipo === 'eventos' ? ESTADOS_EVENTO : ESTADOS_GENERALES;

  protected readonly filas = signal<ResumenContenido[]>([]);
  protected readonly total = signal(0);
  protected readonly tamano = 20;
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly textoBusqueda = signal('');
  private readonly escribiendo = new Subject<string>();

  protected readonly estadoInfo = estadoContenido;
  protected readonly fecha = fechaLarga;
  protected readonly nPagina = computed(() => Math.max(0, (Number(this.pagina()) || 1) - 1));
  protected readonly hayAnterior = computed(() => this.nPagina() > 0);
  protected readonly haySiguiente = computed(() => (this.nPagina() + 1) * this.tamano < this.total());
  protected readonly desde = computed(() => (this.total() === 0 ? 0 : this.nPagina() * this.tamano + 1));
  protected readonly hasta = computed(() => Math.min(this.total(), (this.nPagina() + 1) * this.tamano));

  constructor() {
    effect(() => this.textoBusqueda.set(this.q() ?? ''));
    effect(() => {
      this.q();
      this.estado();
      this.pagina();
      this.cargar();
    });
    this.escribiendo.pipe(debounceTime(400)).subscribe((t) => this.navegar({ q: t.trim() || null }));
  }

  protected consulta(extra: Record<string, string | null>): Record<string, string | null> {
    return { q: this.q() || null, estado: this.estado() || null, pagina: null, ...extra };
  }

  protected navegar(extra: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: this.consulta(extra) });
  }

  protected buscar(t: string): void {
    this.textoBusqueda.set(t);
    this.escribiendo.next(t);
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.contenidos(this.tipo, { q: this.q(), estado: this.estado(), pagina: this.nPagina(), tamano: this.tamano }).subscribe({
      next: (p) => {
        this.filas.set(p.elementos);
        this.total.set(p.total);
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar la lista. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
  }
}
