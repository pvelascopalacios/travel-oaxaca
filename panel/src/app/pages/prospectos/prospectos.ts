import { Component, OnInit, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { Api } from '../../core/api';
import { Catalogos } from '../../core/catalogos';
import { Categoria, Municipio, PersonaEquipo, ProspectoResumen, ResumenVentas } from '../../core/modelos';
import { ErrorApi, categoriasPlanas, leerError } from '../../core/panel';
import { Pendientes } from '../../core/pendientes';
import { ESTADOS_PROSPECTO, ORIGENES, estadoProspecto, origenTexto } from '../../core/ventas';
import { fechaCorta } from '../../core/panel';
import { colorAvatar, enlaceLlamar, enlaceWhatsapp, iniciales } from '../../core/ui';
import { SelectorMunicipio } from '../../shared/selector-municipio';
import { VacioEstado } from '../../shared/vacio';

interface Columna {
  items: ProspectoResumen[];
  total: number;
  pagina: number;
  cargando: boolean;
  fallo: boolean;
}
const VACIA: Columna = { items: [], total: 0, pagina: 0, cargando: true, fallo: false };
const LLAVE_VISTA = 'to_panel_vista_prospectos';
/** Etapas del tablero. «Convertido» y «descartado» se manejan desde la lista y la ficha. */
const ETAPAS_TABLERO = ['nuevo', 'contactado', 'interesado', 'en_alta'];

/** Embudo de ventas: totales por estado como filtros, lista con las acciones más urgentes primero. */
@Component({
  selector: 'app-prospectos',
  imports: [FormsModule, RouterLink, SelectorMunicipio, VacioEstado],
  templateUrl: './prospectos.html',
  styleUrl: './prospectos.scss',
})
export class Prospectos implements OnInit {
  /** /prospectos?estado=nuevo&vencidas=1&sinAsignar=1&asignadoA=…&origen=…&categoriaId=…&municipioId=…&q=…&pagina=2 */
  readonly estado = input<string>();
  readonly vencidas = input<string>();
  readonly sinAsignar = input<string>();
  readonly asignadoA = input<string>();
  readonly origen = input<string>();
  readonly categoriaId = input<string>();
  readonly municipioId = input<string>();
  readonly q = input<string>();
  readonly pagina = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly pendientes = inject(Pendientes);
  protected readonly cat = inject(Catalogos);

  protected readonly estados = ESTADOS_PROSPECTO;
  /** Etapas del embudo (sin «descartado», que va aparte). */
  protected readonly etapas = ESTADOS_PROSPECTO.filter((e) => e.clave !== 'descartado');
  protected readonly iniciales = iniciales;
  protected readonly colorAvatar = colorAvatar;
  protected readonly llamar = enlaceLlamar;
  protected readonly whatsapp = enlaceWhatsapp;
  protected readonly origenes = ORIGENES;
  protected readonly estadoInfo = estadoProspecto;
  protected readonly origenTexto = origenTexto;
  protected readonly fecha = fechaCorta;

  protected readonly columnas = ESTADOS_PROSPECTO.filter((e) => ETAPAS_TABLERO.includes(e.clave));
  protected readonly vista = signal<'lista' | 'tablero'>(this.leerVista());
  private readonly cols = signal<Record<string, Columna>>({});
  protected readonly errorMover = signal<string | null>(null);
  protected readonly arrastrando = signal<ProspectoResumen | null>(null);
  protected readonly sobre = signal<string | null>(null);
  protected readonly moviendo = signal<string | null>(null);
  protected readonly tamanoColumna = 10;

  protected readonly filas = signal<ProspectoResumen[]>([]);
  protected readonly total = signal(0);
  protected readonly tamano = 50;
  protected readonly resumen = signal<ResumenVentas | null>(null);
  protected readonly equipo = signal<PersonaEquipo[]>([]);
  protected readonly arbol = signal<Categoria[]>([]);
  protected readonly categorias = computed(() => categoriasPlanas(this.arbol()));
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly textoBusqueda = signal('');
  private readonly escribiendo = new Subject<string>();

  protected readonly nPagina = computed(() => Math.max(0, (Number(this.pagina()) || 1) - 1));
  protected readonly hayAnterior = computed(() => this.nPagina() > 0);
  protected readonly haySiguiente = computed(() => (this.nPagina() + 1) * this.tamano < this.total());
  protected readonly desde = computed(() => (this.total() === 0 ? 0 : this.nPagina() * this.tamano + 1));
  protected readonly hasta = computed(() => Math.min(this.total(), (this.nPagina() + 1) * this.tamano));
  protected readonly hayFiltros = computed(() => !!(this.estado() || this.vencidas() || this.sinAsignar() || this.asignadoA() || this.origen() || this.categoriaId() || this.municipioId() || this.q()));

  constructor() {
    effect(() => this.textoBusqueda.set(this.q() ?? ''));
    effect(() => {
      this.estado(); this.vencidas(); this.sinAsignar(); this.asignadoA(); this.origen(); this.categoriaId(); this.municipioId(); this.q(); this.pagina();
      if (this.vista() === 'tablero') this.cargarTablero();
      else this.cargar();
    });
    this.escribiendo.pipe(debounceTime(400)).subscribe((t) => this.navegar({ q: t.trim() || null }));
  }

  ngOnInit(): void {
    this.cat.cargar();
    this.cargarResumen();
    this.api.equipoVentas().subscribe({ next: (e) => this.equipo.set(e), error: () => undefined });
    this.api.categorias().subscribe({ next: (c) => this.arbol.set(c), error: () => undefined });
  }

  private cargarResumen(): void {
    this.api.resumenVentas().subscribe({ next: (r) => { this.resumen.set(r); this.pendientes.prospectos.set(r.vencidas); }, error: () => undefined });
  }

  protected consulta(extra: Record<string, string | null>): Record<string, string | null> {
    return {
      estado: this.estado() || null, vencidas: this.vencidas() || null, sinAsignar: this.sinAsignar() || null, asignadoA: this.asignadoA() || null, origen: this.origen() || null,
      categoriaId: this.categoriaId() || null, municipioId: this.municipioId() || null, q: this.q() || null, pagina: null, ...extra,
    };
  }
  protected navegar(extra: Record<string, string | null>): void {
    void this.router.navigate([], { queryParams: this.consulta(extra) });
  }
  protected buscar(t: string): void {
    this.textoBusqueda.set(t);
    this.escribiendo.next(t);
  }
  protected limpiar(): void {
    void this.router.navigate([], { queryParams: {} });
  }
  protected porEstado(clave: string): void {
    this.navegar({ estado: this.estado() === clave ? null : clave });
  }
  protected alternar(k: 'vencidas' | 'sinAsignar'): void {
    this.navegar({ [k]: this[k]() ? null : '1' });
  }
  protected elegirMunicipio(m: Municipio | null): void {
    this.navegar({ municipioId: m?.id ?? null });
  }
  protected cuenta(clave: string): number | null {
    const r = this.resumen();
    return r ? (r.porEstado[clave] ?? 0) : null;
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.api.prospectos({
      estado: this.estado(), vencidas: !!this.vencidas(), sinAsignar: !!this.sinAsignar(), asignadoA: this.asignadoA(), origen: this.origen(),
      categoriaId: this.categoriaId(), municipioId: this.municipioId(), q: this.q(), pagina: this.nPagina(), tamano: this.tamano,
    }).subscribe({
      next: (p) => { this.filas.set(p.elementos); this.total.set(p.total); this.cargando.set(false); },
      error: (e) => { this.fallo.set(leerError(e, 'No pudimos cargar los prospectos. Inténtalo de nuevo.')); this.cargando.set(false); },
    });
  }

  // ---------------- tablero ----------------

  private leerVista(): 'lista' | 'tablero' {
    try { return localStorage.getItem(LLAVE_VISTA) === 'tablero' ? 'tablero' : 'lista'; } catch { return 'lista'; }
  }

  protected cambiarVista(v: 'lista' | 'tablero'): void {
    if (this.vista() === v) return;
    this.vista.set(v);
    try { localStorage.setItem(LLAVE_VISTA, v); } catch { /* sin almacenamiento: solo se pierde la preferencia */ }
    this.errorMover.set(null);
    if (v === 'tablero') this.cargarTablero();
    else this.cargar();
  }

  protected col(clave: string): Columna {
    return this.cols()[clave] ?? VACIA;
  }

  private ponerCol(clave: string, c: Partial<Columna>): void {
    this.cols.update((m) => ({ ...m, [clave]: { ...(m[clave] ?? VACIA), ...c } }));
  }

  /** Cada etapa pide solo sus primeras tarjetas; «Ver más» trae las siguientes. */
  protected cargarTablero(): void {
    this.errorMover.set(null);
    for (const e of ETAPAS_TABLERO) this.cargarColumna(e, 0);
  }

  protected cargarColumna(clave: string, pagina: number): void {
    this.ponerCol(clave, { cargando: true, fallo: false });
    this.api.prospectos({
      estado: clave, vencidas: !!this.vencidas(), sinAsignar: !!this.sinAsignar(), asignadoA: this.asignadoA(), origen: this.origen(),
      categoriaId: this.categoriaId(), municipioId: this.municipioId(), q: this.q(), pagina, tamano: this.tamanoColumna,
    }).subscribe({
      next: (p) => this.ponerCol(clave, { items: pagina === 0 ? p.elementos : [...this.col(clave).items, ...p.elementos], total: p.total, pagina, cargando: false }),
      error: () => this.ponerCol(clave, { cargando: false, fallo: true }),
    });
  }

  protected hayMas(clave: string): boolean {
    const c = this.col(clave);
    return c.items.length < c.total;
  }

  protected arrastrar(e: DragEvent, p: ProspectoResumen): void {
    this.arrastrando.set(p);
    e.dataTransfer?.setData('text/plain', p.id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  protected sobreColumna(e: DragEvent, clave: string): void {
    if (!this.arrastrando()) return;
    e.preventDefault();
    this.sobre.set(clave);
  }

  protected soltar(e: DragEvent, clave: string): void {
    e.preventDefault();
    const p = this.arrastrando();
    this.sobre.set(null);
    this.arrastrando.set(null);
    if (p) this.mover(p, clave);
  }

  /** Cambia la etapa en la API; la tarjeta solo se mueve si la API lo acepta. */
  protected mover(p: ProspectoResumen, destino: string): void {
    if (p.estado === destino || this.moviendo()) return;
    this.errorMover.set(null);
    this.moviendo.set(p.id);
    this.api.estadoProspecto(p.id, destino).subscribe({
      next: () => {
        this.moviendo.set(null);
        const origen = this.col(p.estado);
        this.ponerCol(p.estado, { items: origen.items.filter((x) => x.id !== p.id), total: Math.max(0, origen.total - 1) });
        const dest = this.col(destino);
        this.ponerCol(destino, { items: [{ ...p, estado: destino }, ...dest.items], total: dest.total + 1 });
        this.cargarResumen();
      },
      error: (e) => {
        this.moviendo.set(null);
        this.errorMover.set(leerError(e, 'No pudimos cambiar la etapa.').general);
      },
    });
  }
}
