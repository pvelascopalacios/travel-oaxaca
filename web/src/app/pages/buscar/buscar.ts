import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { BehaviorSubject, EMPTY, Observable, catchError, combineLatest, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { Api } from '../../core/api';
import { Filtros, FILTROS_VACIOS, aQuery, leerFiltros } from '../../core/filtros';
import { DESTINOS_POPULARES } from '../../core/grupos';
import { I18n } from '../../core/i18n';
import { EventoTarjeta, LugarTarjeta, NegocioTarjeta, Pagina } from '../../core/modelos';
import { Seo } from '../../core/seo';
import { TarjetaEvento } from '../../shared/tarjeta-evento';
import { TarjetaLugar } from '../../shared/tarjeta-lugar';
import { TarjetaNegocio } from '../../shared/tarjeta-negocio';
import { Punto, Ubicacion } from '../../shared/ubicacion';

const vacia = <T>(): Pagina<T> => ({ elementos: [], total: 0, pagina: 1, tamano: 0 });

interface Todo {
  negocios: Pagina<NegocioTarjeta>;
  lugares: Pagina<LugarTarjeta>;
  eventos: Pagina<EventoTarjeta>;
}

/** Página de resultados de una búsqueda: negocios con orden y filtros rápidos, y debajo lugares y eventos. */
@Component({
  selector: 'app-buscar',
  imports: [TarjetaNegocio, TarjetaLugar, TarjetaEvento],
  templateUrl: './buscar.html',
  styleUrl: './buscar.scss',
})
export class Buscar {
  protected readonly i18n = inject(I18n);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(Api);
  private readonly seo = inject(Seo);
  private readonly ubicacion = inject(Ubicacion);
  private readonly navegador = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly filtros = signal<Filtros>({ ...FILTROS_VACIOS });
  protected readonly negocios = signal<NegocioTarjeta[]>([]);
  protected readonly lugares = signal<LugarTarjeta[]>([]);
  protected readonly eventos = signal<EventoTarjeta[]>([]);
  protected readonly totalNegocios = signal(0);
  protected readonly cargando = signal(false);
  protected readonly cargandoMas = signal(false);
  protected readonly fallo = signal(false);
  protected readonly avisoUbicacion = signal(false);
  private readonly pagina = signal(1);
  private readonly ubicacion$ = new BehaviorSubject<Punto | null>(null);
  private pidiendo = false;

  protected readonly destinos = DESTINOS_POPULARES;
  protected readonly ordenes = ['relevancia', 'calificacion', 'precio', 'distancia'] as const;

  /** Con menos de dos letras la API no busca; con «cerca de mí» sí se puede listar sin texto. */
  protected readonly puedeBuscar = computed(() => this.filtros().q.length >= 2 || this.filtros().cerca || !!this.filtros().municipio);
  protected readonly titulo = computed(() => {
    const f = this.filtros();
    const lugar = f.municipio && f.en ? ' · ' + f.en : '';
    if (f.q.length >= 2) return this.i18n.tf('tituloBuscar', { q: f.q }) + lugar;
    if (f.municipio && f.en) return this.i18n.tf('todoEn', { lugar: f.en });
    return f.cerca ? this.i18n.t('cercaDeMi') : this.i18n.t('tituloBuscarVacio');
  });
  protected readonly hayMas = computed(() => this.negocios().length < this.totalNegocios());
  protected readonly sinNada = computed(
    () => !this.cargando() && !this.fallo() && this.puedeBuscar() && !this.negocios().length && !this.lugares().length && !this.eventos().length,
  );

  constructor() {
    combineLatest([this.route.queryParamMap.pipe(map((p) => leerFiltros(p))), this.ubicacion$])
      .pipe(
        tap(([f]) => {
          this.filtros.set(f);
          this.fallo.set(false);
          this.seo.pagina(f.q.length >= 2 ? this.i18n.tf('tituloBuscar', { q: f.q }) : this.i18n.t('tituloBuscarVacio'), this.i18n.t('heroTexto'), 'buscar', {
            noIndexar: true,
          });
          if (f.cerca) void this.pedirUbicacion();
        }),
        switchMap(([f, u]) => {
          if (!(f.q.length >= 2 || f.cerca || f.municipio)) {
            this.negocios.set([]);
            this.lugares.set([]);
            this.eventos.set([]);
            this.totalNegocios.set(0);
            return EMPTY;
          }
          this.cargando.set(true);
          return this.todo(f, u, 1).pipe(
            catchError(() => {
              this.fallo.set(true);
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((r) => {
        this.cargando.set(false);
        this.pagina.set(1);
        this.negocios.set(r?.negocios.elementos ?? []);
        this.totalNegocios.set(r?.negocios.total ?? 0);
        this.lugares.set(r?.lugares.elementos ?? []);
        this.eventos.set(r?.eventos.elementos ?? []);
      });
  }

  private paramsNegocios(f: Filtros, u: Punto | null, pagina: number) {
    const conPunto = f.cerca && !!u;
    return {
      q: f.q.length >= 2 ? f.q : undefined,
      municipioId: f.municipio ?? undefined,
      abiertoAhora: f.abierto ? true : undefined,
      precioMax: f.precio ?? undefined,
      orden: f.orden === 'relevancia' || (f.orden === 'distancia' && !conPunto) ? undefined : f.orden,
      lat: conPunto ? u!.lat : undefined,
      lng: conPunto ? u!.lng : undefined,
      cerca: conPunto ? true : undefined,
      pagina,
      tamano: 12,
    };
  }

  private todo(f: Filtros, u: Punto | null, pagina: number): Observable<Todo> {
    const q = f.q.length >= 2 ? f.q : undefined;
    const punto = { municipioId: f.municipio ?? undefined, ...(f.cerca && u ? { lat: u.lat, lng: u.lng, cerca: true } : {}) };
    return forkJoin({
      negocios: this.api.negocios(this.paramsNegocios(f, u, pagina)),
      lugares: this.api.lugares({ q, tamano: 4, ...punto }),
      eventos: q ? this.api.eventos({ q, municipioId: f.municipio ?? undefined, tamano: 4 }) : of(vacia<EventoTarjeta>()),
    });
  }

  protected cambiar(c: Partial<Filtros>): void {
    const nuevo = { ...this.filtros(), ...c };
    void this.router.navigate([], { relativeTo: this.route, queryParams: aQuery(nuevo), replaceUrl: true });
  }

  protected cambiarOrden(valor: string): void {
    const orden = valor as Filtros['orden'];
    this.cambiar(orden === 'distancia' ? { orden, cerca: true } : { orden });
  }

  protected verMas(): void {
    if (this.cargandoMas()) return;
    this.cargandoMas.set(true);
    const sig = this.pagina() + 1;
    this.api
      .negocios(this.paramsNegocios(this.filtros(), this.ubicacion$.value, sig))
      .pipe(catchError(() => of(null)))
      .subscribe((p) => {
        this.cargandoMas.set(false);
        if (!p) return;
        this.pagina.set(sig);
        this.negocios.update((a) => [...a, ...p.elementos]);
      });
  }

  private async pedirUbicacion(): Promise<void> {
    if (this.ubicacion$.value || this.pidiendo || !this.navegador) return;
    this.pidiendo = true;
    const p = await this.ubicacion.obtener();
    this.pidiendo = false;
    if (p) this.ubicacion$.next(p);
    else {
      this.avisoUbicacion.set(true);
      this.cambiar({ cerca: false });
    }
  }

  protected buscarDestino(texto: string): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: texto } });
  }
}
