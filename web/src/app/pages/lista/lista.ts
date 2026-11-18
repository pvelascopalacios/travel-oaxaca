import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, Observable, catchError, combineLatest, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api';
import { Catalogo, DatosCatalogo } from '../../core/catalogo';
import {
  FILTROS_VACIOS, Filtros, ORDENES, Orden, Ver, aQuery, contarFiltros, finDeSemanaMx, hoyMx, idsDeRaices, leerFiltros,
  paramsNegocios, serviciosDelGrupo, sinFiltros,
} from '../../core/filtros';
import { GRUPOS, Grupo } from '../../core/grupos';
import { I18n } from '../../core/i18n';
import { EventoTarjeta, Facetas, LugarTarjeta, NegocioTarjeta, Pagina } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { Clave } from '../../core/textos';
import { FilaNegocio } from '../../shared/fila-negocio';
import { Mapa, Pin, Zona } from '../../shared/mapa';
import { OpcionTipo, PanelFiltros } from '../../shared/panel-filtros';
import { TarjetaEvento } from '../../shared/tarjeta-evento';
import { TarjetaLugar } from '../../shared/tarjeta-lugar';
import { TarjetaNegocio } from '../../shared/tarjeta-negocio';
import { Punto, Ubicacion } from '../../shared/ubicacion';

type Modo = 'negocios' | 'lugares' | 'eventos';

interface Chip {
  id: string;
  texto: string;
  total: number | null;
  activo: boolean;
  cambio: Partial<Filtros>;
}

interface Etiqueta {
  texto: string;
  quitar: Partial<Filtros>;
}

interface Resultado {
  datos: DatosCatalogo;
  facetas: Facetas | null;
  modo: Modo;
  pagina: Pagina<NegocioTarjeta | LugarTarjeta | EventoTarjeta>;
}

const TITULOS: Record<Grupo['clave'], Clave> = {
  dormir: 'tituloDormir',
  comer: 'tituloComer',
  compras: 'tituloCompras',
  descubrir: 'tituloDescubrir',
};

/**
 * Lista de un grupo (Dormir, Comer y beber, Artesanías, Descubrir). Los filtros viven en la dirección.
 * Descubrir junta tres cosas: lugares, tours (negocios) y eventos.
 */
@Component({
  selector: 'app-lista',
  imports: [RouterLink, FilaNegocio, TarjetaNegocio, TarjetaLugar, TarjetaEvento, PanelFiltros, Mapa],
  host: { '(document:keydown.escape)': 'hoja.set(false)' },
  templateUrl: './lista.html',
  styleUrl: './lista.scss',
})
export class Lista {
  protected readonly i18n = inject(I18n);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(Api);
  private readonly catalogo = inject(Catalogo);
  private readonly seo = inject(Seo);
  private readonly ubicacion = inject(Ubicacion);
  private readonly doc = inject(DOCUMENT);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly mapaRef = viewChild(Mapa);

  private readonly datosRuta = this.route.snapshot.data as { grupo: Grupo['clave']; ver?: Ver; titulo?: Clave; ruta: string };
  protected readonly grupo: Grupo = GRUPOS.find((g) => g.clave === this.datosRuta.grupo)!;
  private readonly verOmision: Ver = this.datosRuta.ver ?? 'lugares';

  protected readonly filtros = signal<Filtros>({ ...FILTROS_VACIOS, ver: this.verOmision });
  protected readonly datos = signal<DatosCatalogo | null>(null);
  /** Conteos del municipio elegido; sin municipio se usan los de todo Oaxaca (del catálogo). */
  private readonly facetasMunicipio = signal<Facetas | null>(null);
  private readonly facetas = computed<Facetas | null>(() => (this.filtros().municipio ? this.facetasMunicipio() : null) ?? this.datos()?.facetas ?? null);
  protected readonly negocios = signal<NegocioTarjeta[]>([]);
  protected readonly lugares = signal<LugarTarjeta[]>([]);
  protected readonly eventos = signal<EventoTarjeta[]>([]);
  protected readonly total = signal(0);
  private readonly pagina = signal(1);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly fallo = signal(false);
  protected readonly avisoUbicacion = signal(false);
  protected readonly hoja = signal(false);
  protected readonly elegido = signal<string | null>(null);
  protected readonly extras = signal<Pin[]>([]);
  private extrasSlug = new Map<string, string>();

  private readonly ubicacion$ = new BehaviorSubject<Punto | null>(null);
  private pidiendoUbicacion = false;

  protected readonly ordenes = ORDENES.filter((o) => o !== 'nombre');
  protected readonly hoy = hoyMx();
  protected readonly finDeSemana = finDeSemanaMx();

  protected readonly modo = computed<Modo>(() => {
    if (this.grupo.clave !== 'descubrir') return 'negocios';
    const v = this.filtros().ver;
    return v === 'tours' ? 'negocios' : v;
  });

  protected readonly titulo = computed(() => {
    const en = this.filtros().en;
    if (this.filtros().municipio && en) return this.i18n.tf('tituloEn', { titulo: this.i18n.t(this.grupo.titulo), lugar: en });
    return this.i18n.t(this.datosRuta.titulo ?? TITULOS[this.grupo.clave]);
  });
  protected readonly cuantos = computed(() => this.contarTexto(this.total()));
  protected readonly nFiltros = computed(() => contarFiltros(this.filtros()));
  protected readonly hayFiltros = computed(() => {
    const f = this.filtros();
    return contarFiltros(f) > 0 || !!f.q || !!f.tipoLugar || !!f.municipio;
  });

  protected readonly ids = computed(() => idsDeRaices(this.datos()?.arbol ?? [], this.grupo.raices));
  protected readonly serviciosGrupo = computed(() => serviciosDelGrupo(this.grupo.clave, this.datos()?.servicios ?? []));

  /** Subcategorías del grupo con su conteo, de más a menos. */
  protected readonly tipos = computed<OpcionTipo[]>(() => {
    const fac = this.facetas();
    if (!fac) return [];
    const claves = new Set(this.ids().map((x) => x.clave));
    return fac.negocios
      .filter((x) => claves.has(x.clave) && x.total > 0)
      .map((x) => ({ clave: x.clave, nombre: x.nombre, total: x.total }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  });

  protected readonly chips = computed<Chip[]>(() => {
    const fac = this.facetas();
    const f = this.filtros();
    if (!fac) return [];
    if (this.grupo.clave === 'descubrir') {
      const totalLugares = fac.lugares.reduce((s, x) => s + x.total, 0);
      const tours = this.tipos().reduce((s, x) => s + x.total, 0);
      const base = { ...FILTROS_VACIOS, mapa: false };
      const lista: Chip[] = [
        { id: 'lugares', texto: this.i18n.t('chipLugares'), total: totalLugares, activo: f.ver === 'lugares' && !f.tipoLugar, cambio: { ...base, ver: 'lugares' } },
        { id: 'tours', texto: this.i18n.t('chipTours'), total: tours, activo: f.ver === 'tours', cambio: { ...base, ver: 'tours' } },
        { id: 'eventos', texto: this.i18n.t('chipEventos'), total: fac.eventos, activo: f.ver === 'eventos', cambio: { ...base, ver: 'eventos' } },
      ];
      for (const t of [...fac.lugares].sort((a, b) => b.total - a.total)) {
        if (t.total === 0 || t.tipo === 'otro') continue;
        lista.push({
          id: 'lugar-' + t.tipo,
          texto: this.i18n.tDinamico('tipo', t.tipo),
          total: t.total,
          activo: f.ver === 'lugares' && f.tipoLugar === t.tipo,
          cambio: { ...base, ver: 'lugares', tipoLugar: t.tipo },
        });
      }
      return lista;
    }
    const todos = this.tipos().reduce((s, x) => s + x.total, 0);
    return [
      { id: 'todo', texto: this.i18n.t('todo'), total: todos, activo: f.tipos.length === 0, cambio: { tipos: [] } },
      ...this.tipos().map((t) => ({
        id: t.clave,
        texto: t.nombre,
        total: t.total,
        activo: f.tipos.length === 1 && f.tipos[0] === t.clave,
        cambio: { tipos: [t.clave] },
      })),
    ];
  });

  protected readonly etiquetas = computed<Etiqueta[]>(() => {
    const f = this.filtros();
    const salida: Etiqueta[] = [];
    if (f.municipio) salida.push({ texto: '📍 ' + (f.en || this.i18n.t('municipio')), quitar: { municipio: null, en: '' } });
    for (const t of f.tipos) {
      const nombre = this.tipos().find((x) => x.clave === t)?.nombre ?? t;
      salida.push({ texto: nombre, quitar: { tipos: f.tipos.filter((x) => x !== t) } });
    }
    if (f.abierto) salida.push({ texto: this.i18n.t('abiertoAhora'), quitar: { abierto: false } });
    if (f.precio) salida.push({ texto: `${this.i18n.t('precioHasta')} ${'$'.repeat(f.precio)}`, quitar: { precio: null } });
    for (const s of f.servicios) {
      const nombre = (this.datos()?.servicios ?? []).find((x) => x.clave === s)?.nombre ?? s;
      salida.push({ texto: nombre, quitar: { servicios: f.servicios.filter((x) => x !== s) } });
    }
    for (const i of f.idiomas) {
      salida.push({ texto: this.i18n.t(('idioma_' + i) as Clave), quitar: { idiomas: f.idiomas.filter((x) => x !== i) } });
    }
    if (f.gratis) salida.push({ texto: this.i18n.t(this.modo() === 'lugares' ? 'entradaGratis' : 'gratis'), quitar: { gratis: false } });
    return salida;
  });

  /** El panel lateral cambia según el grupo: Comer pide «abierto ahora», Dormir pide idiomas, etc. */
  protected readonly conPrecio = computed(() => this.grupo.clave !== 'compras');
  protected readonly conAbierto = computed(() => this.grupo.clave === 'comer' || this.grupo.clave === 'compras');
  protected readonly conIdiomas = computed(() => this.grupo.clave === 'dormir' || this.grupo.clave === 'descubrir');
  protected readonly conMapa = computed(() => this.modo() === 'negocios');

  protected readonly pines = computed<Pin[]>(() => {
    const conPrecio = this.grupo.clave === 'dormir' || this.filtros().ver === 'tours';
    return this.negocios()
      .filter((n) => n.latitud != null && n.longitud != null)
      .map((n) => ({
        id: n.id,
        slug: n.slug,
        nombre: n.nombre,
        lat: n.latitud!,
        lng: n.longitud!,
        etiqueta: conPrecio
          ? n.precioDesde != null
            ? this.i18n.precio(n.precioDesde, n.moneda)
            : ''
          : n.rangoPrecio
            ? '$'.repeat(Math.min(n.rangoPrecio, 3))
            : '',
      }));
  });
  protected readonly negocioElegido = computed(() => this.negocios().find((n) => n.id === this.elegido()) ?? null);

  protected readonly eventosPorDia = computed(() => {
    const dias = new Map<string, EventoTarjeta[]>();
    for (const e of this.eventos()) dias.set(e.fechaInicio, [...(dias.get(e.fechaInicio) ?? []), e]);
    return [...dias.entries()].map(([dia, lista]) => ({
      dia,
      texto: this.i18n.fecha(dia, { weekday: 'long', day: 'numeric', month: 'long' }),
      lista,
    }));
  });

  protected readonly hayMas = computed(() => this.cargado() < this.total());
  private readonly cargado = computed(() => {
    const m = this.modo();
    return m === 'negocios' ? this.negocios().length : m === 'lugares' ? this.lugares().length : this.eventos().length;
  });
  protected readonly esqueleto = [1, 2, 3, 4, 5, 6];
  protected readonly cargadosN = computed(() => this.cargado());
  /** Verdadero cuando aún no hay nada que mostrar (primera carga). */
  protected readonly cargado0 = computed(() => this.cargado() === 0);
  protected readonly vacio = computed(() => !this.cargando() && !this.fallo() && this.total() === 0);

  constructor() {
    combineLatest([this.route.queryParamMap.pipe(map((p) => leerFiltros(p, this.verOmision))), this.ubicacion$])
      .pipe(
        tap(([f]) => {
          this.filtros.set(f);
          this.cargando.set(true);
          this.fallo.set(false);
          this.ponerSeo(f);
          if (f.cerca) void this.pedirUbicacion();
        }),
        switchMap(([f, u]) =>
          this.cargar(f, u, 1).pipe(
            catchError(() => {
              this.fallo.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((r) => this.aplicar(r));
  }

  private contarTexto(n: number): string {
    return `${n} ${this.i18n.t(n === 1 ? 'resultadoUno' : 'resultadosN')}`;
  }

  private ponerSeo(f: Filtros): void {
    const conParametros = this.hayFiltrosDe(f) || f.mapa;
    const base = this.datosRuta.ruta;
    this.seo.pagina(this.i18n.t(this.datosRuta.titulo ?? TITULOS[this.grupo.clave]), this.i18n.t(this.grupo.descripcion), base, {
      noIndexar: conParametros,
    });
  }

  private hayFiltrosDe(f: Filtros): boolean {
    return contarFiltros(f) > 0 || !!f.q || !!f.tipoLugar || !!f.municipio || f.ver !== this.verOmision || f.orden !== 'relevancia' || f.cerca;
  }

  private modoDe(f: Filtros): Modo {
    return this.grupo.clave !== 'descubrir' ? 'negocios' : f.ver === 'tours' ? 'negocios' : f.ver;
  }

  private cargar(f: Filtros, u: Punto | null, pagina: number): Observable<Resultado> {
    const modo = this.modoDe(f);
    const facetas$ = f.municipio ? this.api.facetas({ municipioId: f.municipio }).pipe(catchError(() => of(null))) : of(null);
    return forkJoin({ datos: this.catalogo.datos(), facetas: facetas$ }).pipe(
      switchMap(({ datos, facetas }): Observable<Resultado> => {
        if (modo === 'negocios') {
          const p = paramsNegocios(f, {
            ids: idsDeRaices(datos.arbol, this.grupo.raices),
            servicios: datos.servicios,
            pagina,
            tamano: f.mapa ? 30 : 12,
            lat: u?.lat,
            lng: u?.lng,
          });
          return this.api.negocios(p).pipe(map((pag) => ({ datos, facetas, modo, pagina: pag })));
        }
        if (modo === 'lugares') {
          return this.api
            .lugares({
              tipo: f.tipoLugar ?? undefined,
              municipioId: f.municipio ?? undefined,
              entrada: f.gratis ? 'gratis' : undefined,
              cerca: f.cerca && u ? true : undefined,
              lat: f.cerca ? u?.lat : undefined,
              lng: f.cerca ? u?.lng : undefined,
              pagina,
              tamano: 12,
            })
            .pipe(map((pag) => ({ datos, facetas, modo, pagina: pag })));
        }
        return this.api
          .eventos({ desde: f.desde ?? hoyMx(), municipioId: f.municipio ?? undefined, hasta: f.hasta ?? undefined, gratis: f.gratis ? true : undefined, pagina, tamano: 24 })
          .pipe(map((pag) => ({ datos, facetas, modo, pagina: pag })));
      }),
    );
  }

  private aplicar(r: Resultado | null): void {
    this.cargando.set(false);
    this.elegido.set(null);
    this.extras.set([]);
    this.extrasSlug.clear();
    if (!r) {
      this.negocios.set([]);
      this.lugares.set([]);
      this.eventos.set([]);
      this.total.set(0);
      return;
    }
    this.datos.set(r.datos);
    this.facetasMunicipio.set(r.facetas);
    this.pagina.set(1);
    this.total.set(r.pagina.total);
    this.poner(r.modo, r.pagina.elementos, false);
    this.mapaRef()?.reencuadrar();
  }

  private poner(modo: Modo, elementos: (NegocioTarjeta | LugarTarjeta | EventoTarjeta)[], sumar: boolean): void {
    if (modo === 'negocios') {
      this.negocios.update((a) => (sumar ? [...a, ...(elementos as NegocioTarjeta[])] : (elementos as NegocioTarjeta[])));
      if (!sumar) {
        this.lugares.set([]);
        this.eventos.set([]);
      }
    } else if (modo === 'lugares') {
      this.lugares.update((a) => (sumar ? [...a, ...(elementos as LugarTarjeta[])] : (elementos as LugarTarjeta[])));
      if (!sumar) {
        this.negocios.set([]);
        this.eventos.set([]);
      }
    } else {
      this.eventos.update((a) => (sumar ? [...a, ...(elementos as EventoTarjeta[])] : (elementos as EventoTarjeta[])));
      if (!sumar) {
        this.negocios.set([]);
        this.lugares.set([]);
      }
    }
  }

  protected verMas(): void {
    if (this.cargandoMas()) return;
    this.cargandoMas.set(true);
    const siguiente = this.pagina() + 1;
    this.cargar(this.filtros(), this.ubicacion$.value, siguiente)
      .pipe(catchError(() => of(null)))
      .subscribe((r) => {
        this.cargandoMas.set(false);
        if (!r) return;
        this.pagina.set(siguiente);
        this.poner(r.modo, r.pagina.elementos, true);
      });
  }

  /** Pone en la dirección lo que cambió. Se reemplaza la entrada del historial para que Atrás salga de la lista. */
  protected cambiar(c: Partial<Filtros>): void {
    const nuevo = { ...this.filtros(), ...c };
    void this.router.navigate([], { relativeTo: this.route, queryParams: aQuery(nuevo, this.verOmision), replaceUrl: true });
  }

  protected borrarTodo(): void {
    this.cambiar(sinFiltros(this.filtros()));
  }

  protected cambiarOrden(valor: string): void {
    const orden = valor as Orden;
    this.cambiar(orden === 'distancia' ? { orden, cerca: true } : { orden });
  }

  protected alternarCerca(): void {
    const f = this.filtros();
    if (f.cerca) this.cambiar({ cerca: false, orden: f.orden === 'distancia' ? 'relevancia' : f.orden });
    else this.cambiar({ cerca: true, orden: this.modo() === 'negocios' ? 'distancia' : f.orden });
  }

  protected alternarMapa(): void {
    this.cambiar({ mapa: !this.filtros().mapa });
  }

  protected atajoFecha(tipo: 'hoy' | 'fin' | 'todos'): void {
    if (tipo === 'hoy') this.cambiar({ desde: this.hoy, hasta: this.hoy });
    else if (tipo === 'fin') this.cambiar({ desde: this.finDeSemana.desde, hasta: this.finDeSemana.hasta });
    else this.cambiar({ desde: null, hasta: null });
  }

  protected fechaActiva(tipo: 'hoy' | 'fin' | 'todos'): boolean {
    const f = this.filtros();
    if (tipo === 'todos') return !f.desde && !f.hasta;
    if (tipo === 'hoy') return f.desde === this.hoy && f.hasta === this.hoy;
    return f.desde === this.finDeSemana.desde && f.hasta === this.finDeSemana.hasta;
  }

  protected elegirPin(id: string): void {
    const slug = this.extrasSlug.get(id);
    if (slug) {
      void this.router.navigate(['/', this.i18n.lang(), 'negocio', slug]);
      return;
    }
    this.elegido.set(id);
    if (this.navegador) this.doc.getElementById('neg-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /** «Buscar en esta zona»: trae los puntos que caen en el mapa visible y no están en la lista. */
  protected buscarZona(z: Zona): void {
    const f = this.filtros();
    const ids = this.ids();
    const unica = f.tipos.length === 1 ? ids.find((x) => x.clave === f.tipos[0])?.id : undefined;
    this.api.mapa({ ...z, categoriaId: unica }).subscribe({
      next: (puntos) => {
        const claves = new Set(ids.map((x) => x.clave));
        const enLista = new Set(this.negocios().map((n) => n.id));
        const nuevos = puntos.filter((p) => claves.has(p.categoriaClave) && !enLista.has(p.id));
        this.extrasSlug = new Map(nuevos.map((p) => [p.id, p.slug]));
        this.extras.set(nuevos.map((p) => ({ id: p.id, slug: p.slug, nombre: p.nombre, lat: p.latitud, lng: p.longitud, etiqueta: '' })));
      },
      error: () => this.fallo.set(true),
    });
  }

  private async pedirUbicacion(): Promise<void> {
    if (this.ubicacion$.value || this.pidiendoUbicacion || !this.navegador) return;
    this.pidiendoUbicacion = true;
    const p = await this.ubicacion.obtener();
    this.pidiendoUbicacion = false;
    if (p) this.ubicacion$.next(p);
    else {
      this.avisoUbicacion.set(true);
      this.cambiar({ cerca: false, orden: this.filtros().orden === 'distancia' ? 'relevancia' : this.filtros().orden });
    }
  }

  protected rutaBase(): string[] {
    return ['/', this.i18n.lang(), this.datosRuta.ruta];
  }
}
