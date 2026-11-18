import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap, take, tap } from 'rxjs';
import { Api } from '../core/api';
import { Catalogo } from '../core/catalogo';
import { capitalizar, categoriaDe, interpretar, ordenarMunicipios } from '../core/consulta';
import { DESTINOS_POPULARES, GRUPOS } from '../core/grupos';
import { Historial } from '../core/historial';
import { I18n } from '../core/i18n';
import { BusquedaGlobal, Categoria, MunicipioOpcion } from '../core/modelos';

/** Atajos por grupo cuando solo se escribe un lugar. */
const GRUPOS_ATAJO = ['dormir', 'comer', 'descubrir'].map((c) => GRUPOS.find((g) => g.clave === c)!);

interface Opcion {
  texto: string;
  detalle: string;
  /** Ruta sin idioma, o null para buscar el texto. */
  ruta: string[] | null;
  queryParams?: Record<string, string>;
  /** Destino popular: se intenta resolver como municipio y, si no lo es, se busca el texto. */
  destino?: boolean;
}

interface Sugerencias {
  /** Resultados por nombre; null si la API falló o si se escribió un lugar («hoteles en…»). */
  global: BusquedaGlobal | null;
  municipios: MunicipioOpcion[];
  arbol: Categoria[];
}

/**
 * Buscador con sugerencias. Sin escribir ofrece destinos populares y búsquedas recientes;
 * con dos letras o más pide lo primero de negocios, lugares y eventos. Enter busca el texto.
 * Entiende «qué en dónde» («hoteles en huajuapan») y un lugar solo («huajuapan») con los municipios de la API.
 */
@Component({
  selector: 'app-buscador',
  templateUrl: './buscador.html',
  styleUrl: './buscador.scss',
})
export class Buscador {
  protected readonly i18n = inject(I18n);
  protected readonly historial = inject(Historial);
  private readonly api = inject(Api);
  private readonly catalogo = inject(Catalogo);
  private readonly router = inject(Router);
  private readonly caja = viewChild<ElementRef<HTMLInputElement>>('caja');

  /** Identificador del campo; distinto si hay dos buscadores en la misma página (portada y encabezado). */
  readonly idCampo = input('q');

  protected readonly texto = signal('');
  protected readonly abierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly activa = signal(-1);
  protected readonly destinos = DESTINOS_POPULARES;

  private readonly resultado = toSignal(
    toObservable(this.texto).pipe(
      map((t) => t.trim()),
      debounceTime(250),
      distinctUntilChanged(),
      tap((t) => {
        this.activa.set(-1);
        this.cargando.set(t.length >= 2);
      }),
      switchMap((t): Observable<Sugerencias | null> => (t.length < 2 ? of(null) : this.consultar(t))),
      tap(() => this.cargando.set(false)),
    ),
    { initialValue: null as Sugerencias | null },
  );

  protected readonly consultaActiva = computed(() => this.texto().trim().length >= 2);

  private consultar(t: string): Observable<Sugerencias> {
    const c = interpretar(t);
    const lugar = c.donde ?? t;
    return forkJoin({
      global: c.donde ? of(null) : this.api.buscar(t, 4).pipe(catchError(() => of(null))),
      municipios: lugar.length >= 3 ? this.api.municipios(lugar).pipe(map((l) => ordenarMunicipios(l, lugar)), catchError(() => of([] as MunicipioOpcion[]))) : of([] as MunicipioOpcion[]),
      arbol: this.catalogo.datos().pipe(map((d) => d.arbol), catchError(() => of([] as Categoria[]))),
    });
  }

  /** «Buscar así»: la consulta ya armada con su lugar. Va antes que los resultados por nombre. */
  protected readonly armadas = computed<Opcion[]>(() => {
    const r = this.resultado();
    if (!this.consultaActiva() || !r || !r.municipios.length) return [];
    const c = interpretar(this.texto());
    const en = (m: MunicipioOpcion): Record<string, string> => ({ municipio: m.id, en: m.nombre });
    const todoEn = (m: MunicipioOpcion): Opcion => ({
      texto: this.i18n.tf('todoEn', { lugar: m.nombre }),
      detalle: this.i18n.t('todoEnDetalle'),
      ruta: ['buscar'],
      queryParams: en(m),
    });
    if (c.donde) {
      const cat = categoriaDe(c.que, r.arbol);
      const lista = r.municipios.slice(0, 2).map((m): Opcion =>
        cat
          ? {
              texto: this.i18n.tf('tituloEn', { titulo: capitalizar(c.que), lugar: m.nombre }),
              detalle: this.i18n.t(cat.grupo.titulo) + (cat.tipos.length ? ' · ' + cat.nombre : ''),
              ruta: [cat.grupo.ruta],
              queryParams: { ...en(m), ...(cat.tipos.length ? { tipo: cat.tipos.join(',') } : {}) },
            }
          : {
              texto: this.i18n.tf('tituloEn', { titulo: capitalizar(c.que), lugar: m.nombre }),
              detalle: this.i18n.t('buscar'),
              ruta: ['buscar'],
              queryParams: { q: c.que, ...en(m) },
            },
      );
      return [...lista, todoEn(r.municipios[0])];
    }
    const muns = r.municipios.slice(0, 3);
    const lista = muns.map(todoEn);
    if (r.municipios.length <= 2) {
      const m = r.municipios[0];
      for (const g of GRUPOS_ATAJO) {
        lista.push({ texto: this.i18n.tf('tituloEn', { titulo: this.i18n.t(g.titulo), lugar: m.nombre }), detalle: '', ruta: [g.ruta], queryParams: en(m) });
      }
    }
    return lista;
  });

  protected readonly armadasN = computed(() => this.armadas().length);

  private readonly globales = computed<Opcion[]>(() => {
    const r = this.resultado()?.global;
    if (!this.consultaActiva() || !r) return [];
    return [
      ...r.negocios.elementos.map((n) => ({ texto: n.nombre, detalle: `${n.categoriaNombre} · ${n.municipioNombre}`, ruta: ['negocio', n.slug] })),
      ...r.lugares.elementos.map((l) => ({ texto: l.nombre, detalle: `${this.i18n.tDinamico('tipo', l.tipo)} · ${l.municipioNombre ?? ''}`, ruta: ['lugar', l.slug] })),
      ...r.eventos.elementos.map((e) => ({ texto: e.nombre, detalle: `${this.i18n.fecha(e.fechaInicio)} · ${e.municipioNombre ?? ''}`, ruta: ['evento', e.slug] })),
    ];
  });

  protected readonly opciones = computed<Opcion[]>(() => [...this.armadas(), ...this.globales()]);

  protected readonly sinResultados = computed(
    () => this.consultaActiva() && !this.cargando() && this.resultado() !== null && this.opciones().length === 0 && !interpretar(this.texto()).donde,
  );

  /** La consulta ya terminó y no regresó nada utilizable: la API falló. */
  protected readonly fallo = computed(() => this.consultaActiva() && !this.cargando() && this.resultado()?.global === null && !interpretar(this.texto()).donde && this.armadasN() === 0);

  /** Opciones sin escribir: recientes y destinos, en el orden que se recorren con el teclado. */
  protected readonly atajos = computed<Opcion[]>(() => [
    ...this.historial.recientes().map((t) => ({ texto: t, detalle: '', ruta: null })),
    ...this.destinos.map((d) => ({ texto: d, detalle: '', ruta: null, destino: true })),
  ]);

  protected readonly lista = computed(() => (this.consultaActiva() ? this.opciones() : this.atajos()));

  protected escribir(valor: string): void {
    this.texto.set(valor);
    this.cargando.set(valor.trim().length >= 2);
    this.abierto.set(true);
  }

  protected abrir(): void {
    this.abierto.set(true);
  }

  protected cerrarSiSale(evento: FocusEvent): void {
    const raiz = (evento.currentTarget as HTMLElement) ?? null;
    const destino = evento.relatedTarget as Node | null;
    if (!raiz || !destino || !raiz.contains(destino)) this.abierto.set(false);
  }

  protected teclas(e: KeyboardEvent): void {
    const n = this.lista().length;
    if (e.key === 'ArrowDown' && n) {
      e.preventDefault();
      this.abierto.set(true);
      this.activa.update((i) => (i + 1) % n);
    } else if (e.key === 'ArrowUp' && n) {
      e.preventDefault();
      this.activa.update((i) => (i <= 0 ? n - 1 : i - 1));
    } else if (e.key === 'Escape') {
      this.abierto.set(false);
      this.activa.set(-1);
    }
  }

  protected enviar(e: Event): void {
    e.preventDefault();
    const i = this.activa();
    const elegida = i >= 0 ? this.lista()[i] : null;
    if (elegida) this.elegir(elegida);
    else this.buscarTexto(this.texto());
  }

  protected elegir(o: Opcion): void {
    if (o.destino) {
      this.api.municipios(o.texto).pipe(take(1), catchError(() => of([] as MunicipioOpcion[]))).subscribe((l) => {
        const m = l.find((x) => x.nombre.toLowerCase() === o.texto.toLowerCase()) ?? l[0];
        if (!m) return this.buscarTexto(o.texto);
        this.historial.agregar(o.texto);
        this.router.navigate(['/', this.i18n.lang(), 'buscar'], { queryParams: { municipio: m.id, en: m.nombre } });
        this.cerrar();
      });
    } else if (o.ruta) {
      if (o.queryParams) this.historial.agregar(this.texto());
      this.router.navigate(['/', this.i18n.lang(), ...o.ruta], { queryParams: o.queryParams });
      this.cerrar();
    } else {
      this.buscarTexto(o.texto);
    }
  }

  /**
   * Buscar el texto tal cual salió de la caja. Si trae «qué en dónde», se resuelve el lugar aquí mismo, sin depender de que las
   * sugerencias ya hayan cargado: así Enter, el botón Buscar y una búsqueda reciente se comportan igual.
   */
  private buscarTexto(t: string): void {
    const q = t.trim();
    if (q.length < 2) return;
    this.historial.agregar(q);
    const c = interpretar(q);
    if (!c.donde) return this.irATexto(q);
    forkJoin({
      municipios: this.api.municipios(c.donde).pipe(map((l) => ordenarMunicipios(l, c.donde!)), catchError(() => of([] as MunicipioOpcion[]))),
      arbol: this.catalogo.datos().pipe(map((d) => d.arbol), catchError(() => of([] as Categoria[]))),
    })
      .pipe(take(1))
      .subscribe(({ municipios, arbol }) => {
        const m = municipios[0];
        if (!m) return this.irATexto(q);
        const cat = categoriaDe(c.que, arbol);
        const lugar = { municipio: m.id, en: m.nombre };
        if (cat) {
          this.irA([cat.grupo.ruta], { ...lugar, ...(cat.tipos.length ? { tipo: cat.tipos.join(',') } : {}) });
        } else {
          this.irA(['buscar'], { q: c.que, ...lugar });
        }
      });
  }

  private irATexto(q: string): void {
    this.irA(['buscar'], { q });
  }

  private irA(ruta: string[], queryParams: Record<string, string>): void {
    this.router.navigate(['/', this.i18n.lang(), ...ruta], { queryParams });
    this.cerrar();
  }

  private cerrar(): void {
    this.abierto.set(false);
    this.activa.set(-1);
    this.caja()?.nativeElement.blur();
  }
}
