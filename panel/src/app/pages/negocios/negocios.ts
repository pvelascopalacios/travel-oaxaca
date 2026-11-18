import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, switchMap, of, catchError } from 'rxjs';
import { Api } from '../../core/api';
import { ESTADOS_NEGOCIO, estadoNegocioInfo, fechaLarga, origenTexto } from '../../core/cobros';
import { Categoria, NegocioAdmin } from '../../core/modelos';
import { ErrorApi, categoriasPlanas, leerError, nombreCategoria } from '../../core/panel';
import { aPorcentaje, colorAvatar, iniciales, puntajeColor } from '../../core/ui';
import { VacioEstado } from '../../shared/vacio';

const LLAVE_DENSIDAD = 'to_panel_densidad';

/** Todos los negocios del sistema, con filtros. Cada fila abre el negocio. */
@Component({
  selector: 'app-negocios',
  imports: [FormsModule, RouterLink, VacioEstado],
  templateUrl: './negocios.html',
  styleUrl: './negocios.scss',
})
export class Negocios {
  /** Vienen de la dirección: /negocios?q=casa&estado=publicada&categoria=…&municipio=…&mun=Oaxaca&pagina=2 */
  readonly q = input<string>();
  readonly estado = input<string>();
  readonly categoria = input<string>();
  readonly municipio = input<string>();
  readonly mun = input<string>();
  readonly pagina = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);

  protected readonly filas = signal<NegocioAdmin[]>([]);
  protected readonly total = signal(0);
  protected readonly tamano = 20;
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly arbol = signal<Categoria[]>([]);
  protected readonly categorias = computed(() => categoriasPlanas(this.arbol()));
  protected readonly opcionesMunicipio = signal<{ id: string; nombre: string }[]>([]);
  protected readonly textoBusqueda = signal('');
  protected readonly textoMunicipio = signal('');
  private readonly escribiendo = new Subject<string>();
  private readonly escribiendoMun = new Subject<string>();

  protected readonly estados = ESTADOS_NEGOCIO;
  protected readonly iniciales = iniciales;
  protected readonly colorAvatar = colorAvatar;
  protected readonly puntajeColor = puntajeColor;
  protected readonly porcentaje = aPorcentaje;

  /** Cuántos negocios hay en cada estado con la búsqueda, categoría y municipio actuales. «todos» es la suma sin estado. */
  protected readonly conteos = signal<Record<string, number | null>>({});
  private pedidoConteos = 0;

  protected readonly compacta = signal(this.leerDensidad());
  private leerDensidad(): boolean {
    try { return localStorage.getItem(LLAVE_DENSIDAD) === 'compacta'; } catch { return false; }
  }
  protected densidad(compacta: boolean): void {
    this.compacta.set(compacta);
    try { localStorage.setItem(LLAVE_DENSIDAD, compacta ? 'compacta' : 'comoda'); } catch { /* sin almacenamiento: solo se pierde la preferencia */ }
  }
  protected readonly estadoInfo = estadoNegocioInfo;
  protected readonly fecha = fechaLarga;
  protected readonly origen = origenTexto;
  protected readonly categoriaDe = (n: NegocioAdmin): string => nombreCategoria(this.arbol(), n.categoriaClave);

  protected readonly nPagina = computed(() => Math.max(0, (Number(this.pagina()) || 1) - 1));
  protected readonly hayAnterior = computed(() => this.nPagina() > 0);
  protected readonly haySiguiente = computed(() => (this.nPagina() + 1) * this.tamano < this.total());
  protected readonly desde = computed(() => (this.total() === 0 ? 0 : this.nPagina() * this.tamano + 1));
  protected readonly hasta = computed(() => Math.min(this.total(), (this.nPagina() + 1) * this.tamano));

  constructor() {
    this.api.categorias().subscribe({ next: (c) => this.arbol.set(c), error: () => undefined });
    effect(() => {
      this.textoBusqueda.set(this.q() ?? '');
      this.textoMunicipio.set(this.mun() ?? '');
    });
    effect(() => {
      this.q();
      this.estado();
      this.categoria();
      this.municipio();
      this.pagina();
      this.cargar();
    });
    effect(() => {
      this.q();
      this.categoria();
      this.municipio();
      this.cargarConteos();
    });
    this.escribiendo.pipe(debounceTime(400)).subscribe((t) => this.navegar({ q: t.trim() || null }));
    this.escribiendoMun.pipe(
      debounceTime(250),
      switchMap((t) => (t.trim().length >= 2 ? this.api.buscarMunicipios(t.trim()).pipe(catchError(() => of([]))) : of([]))),
    ).subscribe((l) => this.opcionesMunicipio.set(l));
  }

  protected consulta(extra: Record<string, string | null>): Record<string, string | null> {
    return { q: this.q() || null, estado: this.estado() || null, categoria: this.categoria() || null, municipio: this.municipio() || null, mun: this.mun() || null, pagina: null, ...extra };
  }

  /** Filtros activos como chips, cada uno con su clave para quitarlo. */
  protected readonly chips = computed(() => {
    const l: { clave: string; texto: string; extra: Record<string, string | null> }[] = [];
    if (this.q()) l.push({ clave: 'q', texto: `Búsqueda: ${this.q()}`, extra: { q: null } });
    if (this.estado()) l.push({ clave: 'estado', texto: `Estado: ${this.estadoInfo(this.estado()!).texto}`, extra: { estado: null } });
    if (this.categoria()) l.push({ clave: 'categoria', texto: `Categoría: ${this.categorias().find((c) => c.id === this.categoria())?.etiqueta ?? '…'}`, extra: { categoria: null } });
    if (this.municipio()) l.push({ clave: 'municipio', texto: `Municipio: ${this.mun() ?? '…'}`, extra: { municipio: null, mun: null } });
    return l;
  });
  protected quitarFiltros(): void {
    void this.router.navigate([], { queryParams: {} });
  }

  protected navegar(extra: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: this.consulta(extra) });
  }

  protected buscar(t: string): void {
    this.textoBusqueda.set(t);
    this.escribiendo.next(t);
  }

  /** Al escribir un municipio se ofrecen coincidencias; al elegir una exacta se filtra por ella, y vacío quita el filtro. */
  protected escribirMunicipio(t: string): void {
    this.textoMunicipio.set(t);
    if (!t.trim()) {
      if (this.municipio()) this.navegar({ municipio: null, mun: null });
      this.opcionesMunicipio.set([]);
      return;
    }
    const exacto = this.opcionesMunicipio().find((m) => m.nombre.toLowerCase() === t.trim().toLowerCase());
    if (exacto) this.navegar({ municipio: exacto.id, mun: exacto.nombre });
    else this.escribiendoMun.next(t);
  }

  /** Un llamado liviano (una fila) por estado. Si alguno falla, ese chip queda sin número y el resto sirve. */
  protected cargarConteos(): void {
    const pedido = ++this.pedidoConteos;
    const base = { q: this.q(), categoriaId: this.categoria(), municipioId: this.municipio(), tamano: 1 };
    this.conteos.set({});
    for (const clave of ['', ...ESTADOS_NEGOCIO]) {
      this.api.negocios({ ...base, estado: clave || null }).subscribe({
        next: (p) => { if (pedido === this.pedidoConteos) this.conteos.update((c) => ({ ...c, [clave || 'todos']: p.total })); },
        error: () => undefined,
      });
    }
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.negocios({ q: this.q(), estado: this.estado(), categoriaId: this.categoria(), municipioId: this.municipio(), pagina: this.nPagina(), tamano: this.tamano }).subscribe({
      next: (p) => {
        this.filas.set(p.elementos);
        this.total.set(p.total);
        this.cargando.set(false);
      },
      error: (e) => {
        this.fallo.set(leerError(e, 'No pudimos cargar los negocios. Inténtalo de nuevo.'));
        this.cargando.set(false);
      },
    });
  }
}
