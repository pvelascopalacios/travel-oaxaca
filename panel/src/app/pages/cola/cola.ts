import { Component, HostListener, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { Categoria, ColaItem, PromocionCola, Region } from '../../core/modelos';
import {
  ErrorApi, MOTIVO_FICHA, MOTIVO_PROMOCION, PESTANAS, categoriasPlanas, clavePendiente, esperaTexto, fechaHora, leerError, nombreCategoria, periodoPromo, tipoColaInfo, tituloPromo, urgenciaInfo, valorPromo,
} from '../../core/panel';
import { Pendientes } from '../../core/pendientes';
import { moverIndice } from '../../core/ui';
import { Observable, concatMap, from, of, catchError, map, toArray } from 'rxjs';
import { Rechazo } from '../../shared/rechazo';
import { VacioEstado } from '../../shared/vacio';
import { enlazarAviso } from '../../core/avisos';

/** Una fila de la lista: una ficha, un cambio, una foto o una promoción. */
interface Fila {
  clave: string;
  item?: ColaItem;
  promo?: PromocionCola;
  /** Fotos y promociones se aprueban o rechazan aquí; fichas y cambios se abren en su pantalla. */
  resolvible: boolean;
}

/** Cola de revisión: lo más antiguo primero. Las fichas se abren en su detalle; las fotos y promociones se resuelven aquí. */
@Component({
  selector: 'app-cola',
  imports: [RouterLink, FormsModule, Rechazo, VacioEstado],
  templateUrl: './cola.html',
  styleUrl: './cola.scss',
})
export class Cola {
  /** Vienen de la dirección: /revision?tipo=foto&region=…&categoria=…&pagina=1 */
  readonly tipo = input<string>();
  readonly region = input<string>();
  readonly categoria = input<string>();
  readonly pagina = input<string>();

  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly pendientes = inject(Pendientes);

  protected readonly pestanas = PESTANAS;
  protected readonly items = signal<ColaItem[]>([]);
  protected readonly promos = signal<PromocionCola[]>([]);
  protected readonly total = signal(0);
  protected readonly tamano = 20;
  protected readonly cargando = signal(true);
  protected readonly fallo = signal<ErrorApi | null>(null);
  protected readonly regiones = signal<Region[]>([]);
  protected readonly arbol = signal<Categoria[]>([]);
  protected readonly categorias = computed(() => categoriasPlanas(this.arbol()));

  protected readonly trabajandoId = signal<string | null>(null);
  protected readonly rechazandoId = signal<string | null>(null);
  protected readonly errorAccion = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  private readonly _avisoFlotante = enlazarAviso(this.aviso);

  /** Lista única (solicitudes o promociones) con la fila elegida y las marcadas para aprobar en lote. */
  protected readonly filas = computed<Fila[]>(() =>
    this.esPromos()
      ? this.promos().map((p) => ({ clave: p.promocion.id, promo: p, resolvible: true }))
      : this.items().map((i) => ({ clave: clavePendiente(i), item: i, resolvible: i.tipo === 'foto' && !!i.medioId })),
  );
  protected readonly vacio: ReadonlySet<string> = new Set();
  protected readonly indice = signal(0);
  protected readonly actual = computed<Fila | null>(() => this.filas()[moverIndice(this.indice(), 0, this.filas().length)] ?? null);
  protected readonly marcadas = signal<ReadonlySet<string>>(new Set());
  protected readonly resolvibles = computed(() => this.filas().filter((f) => f.resolvible));
  protected readonly todasMarcadas = computed(() => this.resolvibles().length > 0 && this.resolvibles().every((f) => this.marcadas().has(f.clave)));

  protected readonly esPromos = computed(() => this.tipo() === 'promociones');
  protected readonly nPagina = computed(() => Math.max(0, (Number(this.pagina()) || 1) - 1));
  protected readonly hayAnterior = computed(() => this.nPagina() > 0);
  protected readonly haySiguiente = computed(() => (this.nPagina() + 1) * this.tamano < this.total());
  protected readonly desde = computed(() => (this.total() === 0 ? 0 : this.nPagina() * this.tamano + 1));
  protected readonly hasta = computed(() => Math.min(this.total(), (this.nPagina() + 1) * this.tamano));

  protected readonly MOTIVO_FICHA = MOTIVO_FICHA;
  protected readonly MOTIVO_PROMOCION = MOTIVO_PROMOCION;
  protected readonly tipoInfo = tipoColaInfo;
  protected readonly urgencia = urgenciaInfo;
  protected readonly espera = esperaTexto;
  protected readonly hora = fechaHora;
  protected readonly clave = clavePendiente;
  protected readonly valor = valorPromo;
  protected readonly tituloPromo = tituloPromo;
  protected readonly periodo = periodoPromo;
  protected readonly categoriaDe = (i: ColaItem): string => nombreCategoria(this.arbol(), i.categoriaClave);

  constructor() {
    this.api.regiones().subscribe({ next: (r) => this.regiones.set(r), error: () => undefined });
    this.api.categorias().subscribe({ next: (c) => this.arbol.set(c), error: () => undefined });
    this.aviso.set(this.pendientes.aviso());
    this.pendientes.aviso.set(null);
    // Cada cambio de pestaña, filtro o página en la dirección recarga la lista.
    effect(() => {
      this.tipo();
      this.region();
      this.categoria();
      this.pagina();
      this.cargar();
    });
  }

  protected conteo(clave: string): number | null {
    const p = this.pendientes;
    switch (clave) {
      case 'ficha_nueva': return p.fichas();
      case 'cambio': return p.cambios();
      case 'foto': return p.fotos();
      case 'promociones': return p.promociones();
      default: return p.cargado() ? p.total() : null;
    }
  }

  protected consulta(extra: Record<string, string | null>): Record<string, string | null> {
    return { tipo: this.tipo() || null, region: this.region() || null, categoria: this.categoria() || null, pagina: null, ...extra };
  }

  protected readonly chipRegion = computed(() => { const id = this.region(); return id ? (this.regiones().find((r) => r.id === id)?.nombre ?? 'seleccionada') : null; });
  protected readonly chipCategoria = computed(() => { const id = this.categoria(); return id ? (this.categorias().find((c) => c.id === id)?.etiqueta ?? 'seleccionada') : null; });
  protected quitarFiltros(): void {
    void this.router.navigate([], { queryParams: this.consulta({ region: null, categoria: null }) });
  }
  protected filtrar(campo: 'region' | 'categoria', valor: string): void {
    void this.router.navigate([], { queryParams: this.consulta({ [campo]: valor || null }) });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.fallo.set(null);
    this.errorAccion.set(null);
    this.rechazandoId.set(null);
    this.marcadas.set(new Set());
    this.indice.set(0);
    if (this.esPromos()) {
      this.api.colaPromociones(this.nPagina(), this.tamano).subscribe({
        next: (p) => this.alCargar(() => (this.promos.set(p.elementos), this.items.set([])), p.total),
        error: (e) => this.alFallar(e),
      });
    } else {
      this.api.cola({ tipo: this.tipo() || null, regionId: this.region() || null, categoriaId: this.categoria() || null, pagina: this.nPagina(), tamano: this.tamano }).subscribe({
        next: (p) => this.alCargar(() => (this.items.set(p.elementos), this.promos.set([])), p.total),
        error: (e) => this.alFallar(e),
      });
    }
  }

  private alCargar(poner: () => void, total: number): void {
    poner();
    this.total.set(total);
    this.cargando.set(false);
  }

  private alFallar(e: unknown): void {
    this.fallo.set(leerError(e, 'No pudimos cargar la cola. Inténtalo de nuevo.'));
    this.cargando.set(false);
  }

  // ---------------- lista, teclado y lote ----------------

  protected elegir(i: number): void {
    this.indice.set(i);
    this.rechazandoId.set(null);
  }

  protected marcar(clave: string): void {
    this.marcadas.update((m) => {
      const n = new Set(m);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });
  }

  protected marcarTodas(): void {
    this.marcadas.set(this.todasMarcadas() ? new Set() : new Set(this.resolvibles().map((f) => f.clave)));
  }

  protected aprobarActual(): void {
    const f = this.actual();
    if (!f?.resolvible) return;
    if (f.promo) this.aprobarPromo(f.promo);
    else if (f.item) this.aprobarFoto(f.item);
  }

  protected rechazarActual(): void {
    const f = this.actual();
    if (f?.resolvible && !this.trabajandoId()) this.rechazandoId.set(f.clave);
  }

  @HostListener('document:keydown', ['$event'])
  protected tecla(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable)) return;
    const n = this.filas().length;
    switch (e.key.toLowerCase()) {
      case 'j': this.elegir(moverIndice(this.indice(), 1, n)); break;
      case 'k': this.elegir(moverIndice(this.indice(), -1, n)); break;
      case 'a': this.aprobarActual(); break;
      case 'r': e.preventDefault(); this.rechazarActual(); break;
      case 'enter': {
        const i = this.actual()?.item;
        if (i && !this.actual()?.resolvible && t?.tagName !== 'A' && t?.tagName !== 'BUTTON') void this.router.navigate(['/revision/negocios', i.negocioId]);
        break;
      }
      default: return;
    }
  }

  /** Aprueba una por una las marcadas. Si alguna falla se avisa cuántas quedaron y se vuelve a pedir la lista. */
  protected aprobarLote(): void {
    if (this.trabajandoId()) return;
    const fs = this.filas().filter((f) => f.resolvible && this.marcadas().has(f.clave));
    if (fs.length === 0) return;
    this.errorAccion.set(null);
    this.aviso.set(null);
    this.trabajandoId.set('lote');
    const llamada = (f: Fila): Observable<boolean> => {
      const o = f.promo ? this.api.aprobarPromocion(f.promo.promocion.id) : this.api.aprobarFoto(f.item!.medioId!);
      return (o as Observable<unknown>).pipe(map(() => true), catchError(() => of(false)));
    };
    from(fs).pipe(concatMap((f) => llamada(f)), toArray()).subscribe((r) => {
      const bien = r.filter(Boolean).length;
      this.trabajandoId.set(null);
      this.aviso.set(bien === 1 ? '1 aprobada.' : `${bien} aprobadas.`);
      if (bien < fs.length) this.errorAccion.set(`No se pudieron aprobar ${fs.length - bien}. Revisa la lista e inténtalo de nuevo.`);
      this.pendientes.refrescar();
      this.cargar();
    });
  }

  // ---------------- fotos ----------------

  protected aprobarFoto(i: ColaItem): void {
    if (!i.medioId) return;
    this.resolver(clavePendiente(i), this.api.aprobarFoto(i.medioId), () => this.quitar(i), 'Foto aprobada.');
  }

  protected rechazarFoto(i: ColaItem, motivo: string): void {
    if (!i.medioId) return;
    this.resolver(clavePendiente(i), this.api.rechazarFoto(i.medioId, motivo), () => this.quitar(i), 'Foto rechazada. Se envió el motivo al dueño del negocio.');
  }

  private quitar(i: ColaItem): void {
    this.items.update((l) => l.filter((x) => clavePendiente(x) !== clavePendiente(i)));
    this.total.update((t) => Math.max(0, t - 1));
  }

  // ---------------- promociones ----------------

  protected aprobarPromo(p: PromocionCola): void {
    this.resolver(p.promocion.id, this.api.aprobarPromocion(p.promocion.id), () => this.quitarPromo(p), 'Promoción aprobada: ya se muestra.');
  }

  protected rechazarPromo(p: PromocionCola, motivo: string): void {
    this.resolver(p.promocion.id, this.api.rechazarPromocion(p.promocion.id, motivo), () => this.quitarPromo(p), 'Promoción rechazada. Volvió a borrador con tu motivo.');
  }

  private quitarPromo(p: PromocionCola): void {
    this.promos.update((l) => l.filter((x) => x.promocion.id !== p.promocion.id));
    this.total.update((t) => Math.max(0, t - 1));
  }

  private resolver(id: string, llamada: ReturnType<Api['aprobarFoto']> | ReturnType<Api['aprobarPromocion']>, alTerminar: () => void, mensaje: string): void {
    if (this.trabajandoId()) return;
    this.errorAccion.set(null);
    this.aviso.set(null);
    this.trabajandoId.set(id);
    (llamada as ReturnType<Api['aprobarFoto']>).subscribe({
      next: () => {
        this.trabajandoId.set(null);
        this.rechazandoId.set(null);
        alTerminar();
        this.aviso.set(mensaje);
        this.pendientes.refrescar();
      },
      error: (e) => {
        this.trabajandoId.set(null);
        this.errorAccion.set(leerError(e).general);
        // Si ya la resolvió otra persona, la lista cambió: se vuelve a pedir.
        this.cargar();
      },
    });
  }
}
